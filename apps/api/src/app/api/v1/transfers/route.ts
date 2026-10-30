import { transferListQuerySchema } from "@hermes/contracts";
import { prisma, type Prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { apiRoute, json, queryObject } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  const canViewAll = auth.permissions.includes(PERMISSIONS.TRANSFERS_VIEW_ALL);
  const canViewOwn = auth.permissions.includes(PERMISSIONS.TRANSFERS_VIEW_OWN);
  if (!canViewAll && !canViewOwn) throw new ApiError(403, "PERMISSION_DENIED", "Sem permissão para consultar transferências");
  const query = transferListQuerySchema.parse(queryObject(request));
  const where: Prisma.TransferWhereInput = {
    status: query.status,
    batch: { type: query.type, userId: canViewAll ? undefined : auth.user.id },
  };
  const [items, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { batch: { include: { user: { select: { id: true, name: true, email: true } } } }, video: { select: { id: true, name: true } } },
    }),
    prisma.transfer.count({ where }),
  ]);
  return json({ items, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } });
});
