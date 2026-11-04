import { inviteUserSchema } from "@hermes/contracts";
import { hashPassword, prisma } from "@hermes/database";
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
  const passwordHash = await hashPassword(input.password);
  const roles = await prisma.role.findMany({ where: { id: { in: input.roleIds } } });
  if (roles.length !== new Set(input.roleIds).size) throw new ApiError(422, "ROLE_NOT_FOUND", "Um ou mais perfis não existem");

  const user = await prisma.$transaction(async (transaction) => {
    const created = await transaction.user.upsert({
      where: { email: input.email },
      update: { name: input.name, passwordHash, status: "ACTIVE", deletedAt: null, sessionVersion: { increment: 1 } },
      create: { name: input.name, email: input.email, authId: `local-${crypto.randomUUID()}`, passwordHash, status: "ACTIVE" },
    });
    await transaction.userRole.deleteMany({ where: { userId: created.id } });
    await transaction.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: created.id, roleId })) });
    await transaction.auditLog.create({ data: { actorId: auth.user.id, action: "users.invited", resourceType: "user", resourceId: created.id, after: { email: created.email, roleIds: input.roleIds }, correlationId: correlationId(request) } });
    return created;
  });
  return json(user, { status: 201 });
});
