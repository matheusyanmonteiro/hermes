import { updateDriveAccountSchema, uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, noContent, parseJson } from "@/lib/http";

async function accountId(context: unknown): Promise<string> {
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  return uuidSchema.parse(id);
}

export const PATCH = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  const id = await accountId(context);
  const input = updateDriveAccountSchema.parse(await parseJson(request));
  const account = await prisma.driveAccount.update({
    where: { id },
    data: { displayName: input.displayName },
  });
  await prisma.auditLog.create({
    data: {
      actorId: auth.user.id,
      action: "drive.account.updated",
      resourceType: "drive_account",
      resourceId: id,
      after: { displayName: account.displayName },
      correlationId: crypto.randomUUID(),
    },
  });
  return json({ id: account.id, displayName: account.displayName });
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  const id = await accountId(context);
  const account = await prisma.driveAccount.findUnique({
    where: { id },
    select: {
      email: true,
      _count: {
        select: {
          videos: true,
          folders: true,
          syncRuns: true,
          transferBatches: true,
        },
      },
    },
  });
  if (!account)
    throw new ApiError(
      404,
      "DRIVE_ACCOUNT_NOT_FOUND",
      "Conta do Drive não encontrada",
    );

  await prisma.$transaction([
    prisma.transferBatch.updateMany({
      where: { accountId: id },
      data: { accountId: null },
    }),
    prisma.video.deleteMany({ where: { accountId: id } }),
    prisma.syncRun.deleteMany({ where: { accountId: id } }),
    prisma.driveFolder.deleteMany({ where: { accountId: id } }),
    prisma.driveAccount.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "drive.account.deleted",
        resourceType: "drive_account",
        resourceId: id,
        before: { email: account.email, ...account._count },
        correlationId: crypto.randomUUID(),
      },
    }),
  ]);
  return noContent();
});
