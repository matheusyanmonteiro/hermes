import { updateUserAccessSchema, uuidSchema } from "@hermes/contracts";
import { hashPassword, prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.USERS_MANAGE);
  const { id } = await (context as { params: Promise<{ id: string }> }).params; const userId = uuidSchema.parse(id); const input = updateUserAccessSchema.parse(await parseJson(request));
  if (userId === auth.user.id && input.status === "INACTIVE") throw new ApiError(409, "SELF_DEACTIVATION", "Você não pode inativar sua própria conta");
  const current = await prisma.user.findUnique({ where: { id: userId } }); if (!current) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado");
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const user = await prisma.user.update({ where: { id: userId }, data: { ...(input.status ? { status: input.status } : {}), ...(passwordHash ? { passwordHash } : {}), sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({ data: { actorId: auth.user.id, action: "users.access.updated", resourceType: "user", resourceId: userId, before: { status: current.status }, after: { status: user.status, passwordReset: Boolean(passwordHash) }, correlationId: correlationId(request) } });
  return json({ id: user.id, status: user.status });
});
