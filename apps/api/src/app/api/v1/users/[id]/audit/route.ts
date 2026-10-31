import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { auditActionLabel, auditResourceLabel } from "@/lib/audit-labels";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json } from "@/lib/http";

export const GET = apiRoute(async (request, context) => {
  const auth = await authenticate(request); requirePermission(auth, PERMISSIONS.USERS_VIEW);
  const { id } = await (context as { params: Promise<{ id: string }> }).params; const userId = uuidSchema.parse(id);
  const [logs, downloads] = await Promise.all([
    prisma.auditLog.findMany({ where: { OR: [{ actorId: userId }, { resourceType: "user", resourceId: userId }] }, orderBy: { occurredAt: "desc" }, take: 100, select: { id: true, action: true, resourceType: true, resourceId: true, occurredAt: true, correlationId: true } }),
    prisma.downloadEvent.findMany({ where: { userId, eventType: "COMPLETED_CLIENT" }, orderBy: { occurredAt: "desc" }, take: 100, select: { id: true, occurredAt: true, correlationId: true, transfer: { select: { id: true, fileNameSnapshot: true } } } }),
  ]);
  const items = [
    ...logs.map((item) => ({ ...item, actionLabel: auditActionLabel(item.action), resourceLabel: auditResourceLabel(item.resourceType), resourceName: null as string | null })),
    ...downloads.map((item) => ({ id: `download-${item.id}`, action: "downloads.file.completed", actionLabel: "Vídeo baixado", resourceType: "video", resourceLabel: "Vídeo", resourceId: item.transfer.id, resourceName: item.transfer.fileNameSnapshot, occurredAt: item.occurredAt, correlationId: item.correlationId })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 100);
  return json({ items });
});
