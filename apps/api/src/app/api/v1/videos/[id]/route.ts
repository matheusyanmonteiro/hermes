import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json } from "@/lib/http";

export const GET = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.VIDEOS_VIEW);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const video = await prisma.video.findFirst({
    where: { id: uuidSchema.parse(id), deletedAt: null },
    include: {
      account: { select: { id: true, email: true, displayName: true, status: true } },
      folder: true,
      tags: { include: { tag: true } },
      transfers: { take: 10, orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, finishedAt: true } },
    },
  });
  if (!video) throw new ApiError(404, "VIDEO_NOT_FOUND", "Vídeo não encontrado");
  return json(video);
});
