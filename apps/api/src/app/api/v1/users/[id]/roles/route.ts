import { updateUserRolesSchema, uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.USERS_MANAGE);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const userId = uuidSchema.parse(id);
  const input = updateUserRolesSchema.parse(await parseJson(request));
  const [user, roles, before] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.role.findMany({ where: { id: { in: input.roleIds } } }),
    prisma.userRole.findMany({ where: { userId }, select: { roleId: true } }),
  ]);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado");
  if (roles.length !== new Set(input.roleIds).size) throw new ApiError(422, "ROLE_NOT_FOUND", "Um ou mais perfis não existem");
  if (userId === auth.user.id && !roles.some((role) => role.code === "ADMIN")) {
    throw new ApiError(409, "SELF_ADMIN_REMOVAL", "Você não pode remover seu próprio perfil de administrador");
  }
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId, roleId })) }),
    prisma.auditLog.create({ data: { actorId: auth.user.id, action: "users.roles.updated", resourceType: "user", resourceId: userId, before: { roleIds: before.map((item) => item.roleId) }, after: { roleIds: input.roleIds }, correlationId: correlationId(request) } }),
  ]);
  return json({ id: userId, roleIds: input.roleIds });
});
