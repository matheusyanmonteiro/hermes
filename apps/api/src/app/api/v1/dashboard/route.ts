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
  const canManageDrive = auth.permissions.includes(PERMISSIONS.DRIVE_MANAGE);
  const canViewUsers = auth.permissions.includes(PERMISSIONS.USERS_VIEW);
  const batchFilter = canViewAll ? {} : { userId: auth.user.id };
  const [videoCount, userCount, driveAccounts, campaign, batches, recentTransfers, completedCount, failedCount, activeCount] = await Promise.all([
    prisma.video.count({ where: { deletedAt: null } }),
    canViewUsers ? prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }) : Promise.resolve(null),
    canManageDrive ? prisma.driveAccount.findMany({ select: { id: true, email: true, displayName: true, status: true, lastSyncedAt: true } }) : Promise.resolve([]),
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
    prisma.transfer.count({ where: { batch: batchFilter, status: { in: ["PENDING", "REQUESTED", "AUTHORIZED", "STARTED", "IN_PROGRESS"] } } }),
  ]);

  return json({
    audience: canViewUsers ? "ADMIN" : canViewAll ? "OPERATOR" : "READER",
    capabilities: { canViewAll, canManageDrive, canViewUsers },
    metrics: { videoCount, userCount, batchCount: batches, completedCount, failedCount, activeCount },
    campaign,
    driveAccounts,
    recentTransfers,
  });
});
