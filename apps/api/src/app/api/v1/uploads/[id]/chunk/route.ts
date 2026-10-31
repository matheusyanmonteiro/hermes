import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { authenticate } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { ApiError } from "@/lib/errors";
import { driveFetch } from "@/lib/google-drive";
import { apiRoute, json } from "@/lib/http";

export const POST = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const transferId = uuidSchema.parse(id);
  const transfer = await prisma.transfer.findUnique({ where: { id: transferId }, include: { batch: true } });
  if (!transfer || transfer.batch.type !== "UPLOAD" || transfer.batch.userId !== auth.user.id) throw new ApiError(404, "TRANSFER_NOT_FOUND", "Transferência não encontrada");
  if (!transfer.batch.accountId || !transfer.resumableSessionEncrypted) throw new ApiError(409, "UPLOAD_SESSION_MISSING", "A sessão de upload não está disponível");
  const contentRange = request.headers.get("content-range");
  if (!contentRange) throw new ApiError(400, "CONTENT_RANGE_REQUIRED", "Envie o cabeçalho Content-Range");
  const upstream = await driveFetch(transfer.batch.accountId, decryptSecret(transfer.resumableSessionEncrypted), {
    method: "PUT",
    headers: { "content-type": request.headers.get("content-type") ?? "application/octet-stream", "content-range": contentRange },
    body: await request.arrayBuffer(),
  });
  if (upstream.status === 308) return json({ complete: false }, { status: 200 });
  if (!upstream.ok) throw new ApiError(502, "DRIVE_UPLOAD_FAILED", "O Google Drive recusou um bloco do upload", await upstream.text());
  const payload = (await upstream.json()) as { id?: string };
  if (!payload.id) throw new ApiError(502, "DRIVE_UPLOAD_INVALID_RESPONSE", "O Google Drive não confirmou o arquivo enviado");
  return json({ complete: true, driveFileId: payload.id });
});
