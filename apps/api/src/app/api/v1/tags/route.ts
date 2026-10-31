import { createTagSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json, parseJson } from "@/lib/http";

export const GET = apiRoute(async (request) => { const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.VIDEOS_VIEW); return json({ items: await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { videos: true } } } }) }); });
export const POST = apiRoute(async (request) => { const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.VIDEOS_MANAGE); const input = createTagSchema.parse(await parseJson(request)); return json(await prisma.tag.create({ data: input }), { status: 201 }); });
