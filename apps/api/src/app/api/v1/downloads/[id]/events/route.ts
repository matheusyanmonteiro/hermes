import { downloadEventSchema, uuidSchema, type TransferStatus } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { authenticate } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertTransferTransition, isFinalStatus } from "@/lib/transfer-state";

export const POST = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  await enforceRateLimit(request, "downloads.events", auth.user.id, 300, 60);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const transferId = uuidSchema.parse(id);
  const input = downloadEventSchema.parse(await parseJson(request));
  const transfer = await prisma.transfer.findUnique({ where: { id: transferId }, include: { batch: true } });
  if (!transfer || transfer.batch.type !== "DOWNLOAD") throw new ApiError(404, "TRANSFER_NOT_FOUND", "Transferência não encontrada");

  if (transfer.batch.userId !== auth.user.id) {
    throw new ApiError(403, "PERMISSION_DENIED", "Esta transferência pertence a outro usuário");
  }

  const nextStatus = input.eventType as TransferStatus;
  assertTransferTransition(transfer.status as TransferStatus, nextStatus);
  const bytes = input.bytesTransferred === undefined ? transfer.bytesTransferred : BigInt(input.bytesTransferred);
  if (bytes > transfer.fileSizeSnapshot) throw new ApiError(422, "INVALID_BYTE_COUNT", "O progresso excede o tamanho do arquivo");

  const now = new Date();
  const suppliedDate = input.occurredAt ? new Date(input.occurredAt) : now;
  const occurredAt = Math.abs(suppliedDate.getTime() - now.getTime()) <= 86_400_000 ? suppliedDate : now;
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.downloadEvent.create({
      data: {
        transferId,
        userId: auth.user.id,
        eventType: nextStatus,
        bytesTransferred: bytes,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        occurredAt,
        correlationId: correlationId(request),
      },
    });
    return transaction.transfer.update({
      where: { id: transferId },
      data: {
        status: nextStatus,
        bytesTransferred: bytes,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        startedAt: nextStatus === "STARTED" && !transfer.startedAt ? now : undefined,
        finishedAt: isFinalStatus(nextStatus) ? now : undefined,
      },
    });
  });
  return json(updated);
});
