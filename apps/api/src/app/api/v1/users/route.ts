import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { inviteUserSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.USERS_VIEW);
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true, roles: { include: { role: true } } },
  });
  return json({ items: users });
});

export const POST = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.USERS_MANAGE);
  await enforceRateLimit(request, "users.invite", auth.user.id, 20, 60 * 60);
  const input = inviteUserSchema.parse(await parseJson(request));
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${Buffer.from(await promisify(scrypt)(input.password, salt, 64) as Buffer).toString("hex")}`;
  const roles = await prisma.role.findMany({ where: { id: { in: input.roleIds } } });
  if (roles.length !== new Set(input.roleIds).size) throw new ApiError(422, "ROLE_NOT_FOUND", "Um ou mais perfis não existem");

  let authId = `dev-invited-${crypto.randomUUID()}`;
  if (process.env.AUTH_MODE === "supabase") {
    const url = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) throw new ApiError(500, "AUTH_CONFIGURATION_ERROR", "A chave secreta do Supabase não foi configurada");
    const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.admin.inviteUserByEmail(input.email, { data: { name: input.name } });
    if (error || !data.user) throw new ApiError(502, "INVITE_FAILED", "O Supabase não enviou o convite", error?.message);
    authId = data.user.id;
  }

  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.upsert({
      where: { email: input.email },
      update: { name: input.name, authId, passwordHash, status: process.env.AUTH_MODE === "supabase" ? "INVITED" : "ACTIVE", deletedAt: null },
      create: { name: input.name, email: input.email, authId, passwordHash, status: process.env.AUTH_MODE === "supabase" ? "INVITED" : "ACTIVE" },
    });
    await transaction.userRole.deleteMany({ where: { userId: created.id } });
    await transaction.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: created.id, roleId })) });
    await transaction.auditLog.create({ data: { actorId: auth.user.id, action: "users.invited", resourceType: "user", resourceId: created.id, after: { email: created.email, roleIds: input.roleIds }, correlationId: correlationId(request) } });
    return created;
  });
  return json(user, { status: 201 });
});
