import { completeUploadSchema, uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { authenticate } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, parseJson } from "@/lib/http";

export const POST = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const transferId = uuidSchema.parse(id);
  const input = completeUploadSchema.parse(await parseJson(request));
  const transfer = await prisma.transfer.findUnique({ where: { id: transferId }, include: { batch: true } });
  if (!transfer || transfer.batch.type !== "UPLOAD") throw new ApiError(404, "TRANSFER_NOT_FOUND", "Transferência não encontrada");
  if (transfer.batch.userId !== auth.user.id) throw new ApiError(403, "PERMISSION_DENIED", "Esta transferência pertence a outro usuário");
  if (!transfer.batch.accountId) throw new ApiError(409, "TRANSFER_ACCOUNT_MISSING", "A transferência não possui uma conta de destino");

  const tagIds = Array.isArray(transfer.tagIdsSnapshot) ? transfer.tagIdsSnapshot.filter((id): id is string => typeof id === "string") : [];
  const video = await prisma.video.upsert({
    where: { accountId_driveFileId: { accountId: transfer.batch.accountId, driveFileId: input.driveFileId } },
    update: { name: transfer.fileNameSnapshot, sizeBytes: transfer.fileSizeSnapshot, mimeType: transfer.mimeTypeSnapshot, checksum: input.checksum, deletedAt: null, driveModifiedAt: new Date() },
    create: { accountId: transfer.batch.accountId, driveFileId: input.driveFileId, name: transfer.fileNameSnapshot, sizeBytes: transfer.fileSizeSnapshot, mimeType: transfer.mimeTypeSnapshot, checksum: input.checksum, driveModifiedAt: new Date() },
  });
  if (tagIds.length) await prisma.videoTag.createMany({ data: tagIds.map((tagId) => ({ videoId: video.id, tagId })), skipDuplicates: true });
  const updated = await prisma.transfer.update({ where: { id: transfer.id }, data: { videoId: video.id, status: "COMPLETED_CLIENT", bytesTransferred: transfer.fileSizeSnapshot, finishedAt: new Date(), resumableSessionEncrypted: null } });
  return json(updated);
});
