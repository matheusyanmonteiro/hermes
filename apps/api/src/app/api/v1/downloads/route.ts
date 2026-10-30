import { createDownloadSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { requireActiveCampaign } from "@/lib/campaign";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";

export const POST = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DOWNLOADS_CREATE);
  await requireActiveCampaign();
  const input = createDownloadSchema.parse(await parseJson(request));
  const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 120);
  if (!idempotencyKey) throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Envie o cabeçalho Idempotency-Key");

  const existing = await prisma.transferBatch.findUnique({
    where: { userId_idempotencyKey: { userId: auth.user.id, idempotencyKey } },
    include: { transfers: true },
  });
  if (existing) return json({ batch: existing, idempotentReplay: true });

  const videos = await prisma.video.findMany({
    where: { id: { in: input.videoIds }, deletedAt: null },
    include: { account: { select: { email: true } } },
  });
  if (videos.length !== new Set(input.videoIds).size) {
    throw new ApiError(404, "VIDEO_NOT_FOUND", "Um ou mais vídeos não foram encontrados");
  }

  const batch = await prisma.$transaction(async (transaction) => {
    const created = await transaction.transferBatch.create({
      data: {
        userId: auth.user.id,
        accountId: videos.every((video) => video.accountId === videos[0]?.accountId) ? videos[0]?.accountId : null,
        type: "DOWNLOAD",
        status: "AUTHORIZED",
        idempotencyKey,
        totalFiles: videos.length,
        totalBytes: videos.reduce((total, video) => total + video.sizeBytes, 0n),
        transfers: {
          create: videos.map((video) => ({
            videoId: video.id,
            status: "AUTHORIZED",
            fileNameSnapshot: video.name,
            fileSizeSnapshot: video.sizeBytes,
            sourceSnapshot: video.account.email,
            mimeTypeSnapshot: video.mimeType,
            events: {
              create: {
                userId: auth.user.id,
                eventType: "AUTHORIZED",
                correlationId: correlationId(request),
              },
            },
          })),
        },
      },
      include: { transfers: true },
    });
    await transaction.auditLog.create({
      data: {
        actorId: auth.user.id,
        action: "downloads.batch.created",
        resourceType: "transfer_batch",
        resourceId: created.id,
        after: { videoIds: input.videoIds, totalFiles: videos.length },
        correlationId: correlationId(request),
      },
    });
    return created;
  });

  return json({ batch, idempotentReplay: false }, { status: 201 });
});
