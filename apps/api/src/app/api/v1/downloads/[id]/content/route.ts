import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { driveFetch } from "@/lib/google-drive";
import { apiRoute, correlationId } from "@/lib/http";

export const GET = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const transfer = await prisma.transfer.findUnique({ where: { id: uuidSchema.parse(id) }, include: { batch: true, video: true } });
  if (!transfer || transfer.batch.type !== "DOWNLOAD" || !transfer.video) throw new ApiError(404, "TRANSFER_NOT_FOUND", "Transferência não encontrada");
  const canViewAll = auth.permissions.includes(PERMISSIONS.TRANSFERS_VIEW_ALL);
  if (transfer.batch.userId !== auth.user.id && !canViewAll) throw new ApiError(403, "PERMISSION_DENIED", "Esta transferência pertence a outro usuário");
  if (!["AUTHORIZED", "STARTED", "IN_PROGRESS"].includes(transfer.status)) throw new ApiError(409, "TRANSFER_NOT_AVAILABLE", "Esta transferência não está disponível");

  const range = request.headers.get("range");
  const upstream = await driveFetch(transfer.video.accountId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(transfer.video.driveFileId)}?alt=media`, {
    headers: range ? { range } : undefined,
  });
  if (!upstream.ok || !upstream.body) {
    await prisma.transfer.update({ where: { id: transfer.id }, data: { status: "FAILED", errorCode: `DRIVE_${upstream.status}`, errorMessage: "Falha ao iniciar a leitura no Google Drive", finishedAt: new Date() } });
    throw new ApiError(502, "DRIVE_DOWNLOAD_FAILED", "O Google Drive não disponibilizou o arquivo");
  }

  await prisma.$transaction([
    prisma.transfer.update({ where: { id: transfer.id }, data: { status: range ? "IN_PROGRESS" : "STARTED", startedAt: transfer.startedAt ?? new Date(), attemptCount: { increment: 1 } } }),
    prisma.downloadEvent.create({ data: { transferId: transfer.id, userId: auth.user.id, eventType: range ? "IN_PROGRESS" : "STARTED", correlationId: correlationId(request) } }),
  ]);

  const headers = new Headers();
  for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", transfer.mimeTypeSnapshot);
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(transfer.fileNameSnapshot)}`);
  headers.set("cache-control", "private, no-store");
  headers.set("x-correlation-id", correlationId(request));
  return new Response(upstream.body, { status: upstream.status, headers });
});
