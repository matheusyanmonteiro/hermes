import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { getCurrentCampaign } from "@/lib/campaign";
import { apiRoute, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DASHBOARD_VIEW);

  const canViewAll = auth.permissions.includes(PERMISSIONS.TRANSFERS_VIEW_ALL);
  const batchFilter = canViewAll ? {} : { userId: auth.user.id };
  const [videoCount, userCount, driveAccounts, campaign, batches, recentTransfers, completedCount, failedCount] = await Promise.all([
    prisma.video.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.driveAccount.findMany({ select: { id: true, email: true, displayName: true, status: true, lastSyncedAt: true } }),
    getCurrentCampaign(),
    prisma.transferBatch.count({ where: batchFilter }),
    prisma.transfer.findMany({
      where: { batch: batchFilter },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { batch: { include: { user: { select: { name: true } } } } },
    }),
    prisma.transfer.count({ where: { batch: batchFilter, status: "COMPLETED_CLIENT" } }),
    prisma.transfer.count({ where: { batch: batchFilter, status: "FAILED" } }),
  ]);

  return json({
    metrics: { videoCount, userCount, batchCount: batches, completedCount, failedCount },
    campaign,
    driveAccounts,
    recentTransfers,
  });
});
