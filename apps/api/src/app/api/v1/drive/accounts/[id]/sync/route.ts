import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { driveFetch } from "@/lib/google-drive";
import { apiRoute, json } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

type DriveFile = {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum?: string;
  thumbnailLink?: string;
  parents?: string[];
  videoMediaMetadata?: { durationMillis?: string };
};

export const maxDuration = 300;

export const POST = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  await enforceRateLimit(request, "drive.sync", auth.user.id, 10, 10 * 60);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const accountId = uuidSchema.parse(id);
  const account = await prisma.driveAccount.findUnique({ where: { id: accountId }, include: { folders: true } });
  if (!account) throw new ApiError(404, "DRIVE_ACCOUNT_NOT_FOUND", "Conta do Drive não encontrada");

  const selectedFolders = account.folders.filter((folder) => folder.syncEnabled);
  if (!selectedFolders.length) throw new ApiError(409, "DRIVE_FOLDERS_NOT_SELECTED", "Selecione ao menos uma pasta antes de sincronizar");
  const run = await prisma.syncRun.create({ data: { accountId, status: "RUNNING", startedAt: new Date() } });
  try {
    const seenIds: string[] = [];
    let pageToken: string | undefined;
    let created = 0;
    let updated = 0;
    do {
      const params = new URLSearchParams({
        q: `trashed = false and mimeType contains 'video/' and (${selectedFolders.map((folder) => `'${folder.driveFolderId}' in parents`).join(" or ")})`,
        pageSize: "1000",
        fields: "nextPageToken,files(id,name,size,mimeType,modifiedTime,md5Checksum,thumbnailLink,parents,videoMediaMetadata(durationMillis))",
        spaces: "drive",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await driveFetch(accountId, `https://www.googleapis.com/drive/v3/files?${params}`);
      if (!response.ok) throw new ApiError(502, "DRIVE_SYNC_FAILED", "O Google Drive recusou a sincronização");
      const payload = (await response.json()) as { files: DriveFile[]; nextPageToken?: string };
      pageToken = payload.nextPageToken;
      for (const file of payload.files) {
        seenIds.push(file.id);
        const existing = await prisma.video.findUnique({ where: { accountId_driveFileId: { accountId, driveFileId: file.id } } });
        const folder = account.folders.find((candidate) => file.parents?.includes(candidate.driveFolderId));
        await prisma.video.upsert({
          where: { accountId_driveFileId: { accountId, driveFileId: file.id } },
          update: {
            name: file.name,
            sizeBytes: BigInt(file.size ?? 0),
            mimeType: file.mimeType,
            checksum: file.md5Checksum,
            thumbnailUrl: file.thumbnailLink,
            durationSeconds: file.videoMediaMetadata?.durationMillis ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000) : null,
            driveModifiedAt: new Date(file.modifiedTime),
            folderId: folder?.id,
            deletedAt: null,
          },
          create: {
            accountId,
            folderId: folder?.id,
            driveFileId: file.id,
            name: file.name,
            sizeBytes: BigInt(file.size ?? 0),
            mimeType: file.mimeType,
            checksum: file.md5Checksum,
            thumbnailUrl: file.thumbnailLink,
            durationSeconds: file.videoMediaMetadata?.durationMillis ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000) : null,
            driveModifiedAt: new Date(file.modifiedTime),
          },
        });
        existing ? updated++ : created++;
      }
    } while (pageToken);

    const removed = await prisma.video.updateMany({
      where: { accountId, driveFileId: { notIn: seenIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await prisma.$transaction([
      prisma.syncRun.update({ where: { id: run.id }, data: { status: "COMPLETED", filesFound: seenIds.length, filesCreated: created, filesUpdated: updated, filesRemoved: removed.count, finishedAt: new Date() } }),
      prisma.driveAccount.update({ where: { id: accountId }, data: { lastSyncedAt: new Date(), status: "CONNECTED", lastError: null } }),
      prisma.auditLog.create({ data: { actorId: auth.user.id, action: "drive.account.synced", resourceType: "drive_account", resourceId: accountId, after: { filesFound: seenIds.length, created, updated, removed: removed.count }, correlationId: crypto.randomUUID() } }),
    ]);
    return json({ syncRunId: run.id, filesFound: seenIds.length, created, updated, removed: removed.count });
  } catch (error) {
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido", finishedAt: new Date() } });
    throw error;
  }
});
