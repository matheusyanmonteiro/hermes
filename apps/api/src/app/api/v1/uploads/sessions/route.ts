import { createUploadSessionsSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { requireActiveCampaign } from "@/lib/campaign";
import { encryptSecret } from "@/lib/crypto";
import { ApiError } from "@/lib/errors";
import { driveFetch } from "@/lib/google-drive";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";

export const POST = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.UPLOADS_CREATE);
  await requireActiveCampaign();
  const input = createUploadSessionsSchema.parse(await parseJson(request));
  const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 120);
  if (!idempotencyKey) throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Envie o cabeçalho Idempotency-Key");

  const existing = await prisma.transferBatch.findUnique({
    where: { userId_idempotencyKey: { userId: auth.user.id, idempotencyKey } },
    include: { transfers: true },
  });
  if (existing) return json({ batchId: existing.id, transfers: existing.transfers.map(({ resumableSessionEncrypted: _secret, ...transfer }) => transfer), idempotentReplay: true });

  const [account, folder] = await Promise.all([
    prisma.driveAccount.findUnique({ where: { id: input.accountId } }),
    input.folderId ? prisma.driveFolder.findFirst({ where: { id: input.folderId, accountId: input.accountId } }) : null,
  ]);
  if (!account) throw new ApiError(404, "DRIVE_ACCOUNT_NOT_FOUND", "Conta do Drive não encontrada");
  if (input.folderId && !folder) throw new ApiError(404, "DRIVE_FOLDER_NOT_FOUND", "Pasta do Drive não encontrada");

  const batch = await prisma.transferBatch.create({
    data: {
      userId: auth.user.id,
      accountId: account.id,
      type: "UPLOAD",
      status: "PENDING",
      idempotencyKey,
      totalFiles: input.files.length,
      totalBytes: input.files.reduce((sum, file) => sum + BigInt(file.sizeBytes), 0n),
      transfers: {
        create: input.files.map((file) => ({
          status: "PENDING",
          clientFileId: file.clientId,
          fileNameSnapshot: file.name,
          fileSizeSnapshot: BigInt(file.sizeBytes),
          sourceSnapshot: account.email,
          mimeTypeSnapshot: file.mimeType,
        })),
      },
    },
    include: { transfers: true },
  });

  const sessions = [];
  for (const transfer of batch.transfers) {
    const response = await driveFetch(account.id, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": transfer.mimeTypeSnapshot,
        "x-upload-content-length": transfer.fileSizeSnapshot.toString(),
      },
      body: JSON.stringify({ name: transfer.fileNameSnapshot, parents: folder ? [folder.driveFolderId] : undefined }),
    });
    const sessionUrl = response.headers.get("location");
    if (!response.ok || !sessionUrl) {
      await prisma.transfer.update({ where: { id: transfer.id }, data: { status: "FAILED", errorCode: "DRIVE_SESSION_FAILED", errorMessage: "O Google Drive não iniciou a sessão de upload" } });
      continue;
    }
    await prisma.transfer.update({ where: { id: transfer.id }, data: { status: "AUTHORIZED", resumableSessionEncrypted: encryptSecret(sessionUrl) } });
    sessions.push({
      transferId: transfer.id,
      clientId: transfer.clientFileId,
      sessionUrl,
      chunkSizeBytes: Number(process.env.UPLOAD_CHUNK_SIZE_BYTES ?? 8_388_608),
    });
  }

  await prisma.$transaction([
    prisma.transferBatch.update({ where: { id: batch.id }, data: { status: sessions.length === input.files.length ? "AUTHORIZED" : "FAILED" } }),
    prisma.auditLog.create({ data: { actorId: auth.user.id, action: "uploads.batch.created", resourceType: "transfer_batch", resourceId: batch.id, after: { totalFiles: input.files.length, sessionsCreated: sessions.length }, correlationId: correlationId(request) } }),
  ]);
  return json({ batchId: batch.id, sessions, idempotentReplay: false }, { status: 201 });
});
