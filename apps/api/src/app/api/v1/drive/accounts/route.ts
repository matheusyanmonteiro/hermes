import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json } from "@/lib/http";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_VIEW);
  const accounts = await prisma.driveAccount.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      lastError: true,
      createdAt: true,
      _count: { select: { folders: true, videos: true } },
    },
  });
  return json({ items: accounts });
});
