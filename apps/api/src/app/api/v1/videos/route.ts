import { videoListQuerySchema } from "@hermes/contracts";
import { prisma, type Prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json, queryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.VIDEOS_VIEW);
  const query = videoListQuerySchema.parse(queryObject(request));
  const where: Prisma.VideoWhereInput = {
    deletedAt: null,
    accountId: query.accountId,
    folderId: query.folderId,
    name: query.search ? { contains: query.search, mode: "insensitive" } : undefined,
    tags: query.tag ? { some: { tag: { name: query.tag } } } : undefined,
  };
  const sortField = query.sort === "modifiedAt" ? "driveModifiedAt" : query.sort;
  const orderBy = { [sortField]: query.order } as Prisma.VideoOrderByWithRelationInput;
  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        account: { select: { id: true, email: true, displayName: true } },
        folder: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.video.count({ where }),
  ]);
  return json({ items, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } });
});
