import { applyTagToVideosSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, parseJson } from "@/lib/http";

export const POST = apiRoute(async (request) => { const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.VIDEOS_MANAGE); const input = applyTagToVideosSchema.parse(await parseJson(request)); const [tag, count] = await Promise.all([prisma.tag.findUnique({ where: { id: input.tagId } }), prisma.video.count({ where: { id: { in: input.videoIds }, deletedAt: null } })]); if (!tag) throw new ApiError(404, "TAG_NOT_FOUND", "Etiqueta não encontrada"); if (count !== new Set(input.videoIds).size) throw new ApiError(404, "VIDEO_NOT_FOUND", "Um ou mais vídeos não foram encontrados"); await prisma.videoTag.createMany({ data: input.videoIds.map((videoId) => ({ videoId, tagId: input.tagId })), skipDuplicates: true }); return json({ applied: input.videoIds.length, tag }); });
