import { uuidSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { apiRoute, json } from "@/lib/http";

export const GET = apiRoute(async (request, context) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.UPLOADS_CREATE);
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const accountId = uuidSchema.parse(id);
  const items = await prisma.driveFolder.findMany({ where: { accountId, syncEnabled: true }, select: { id: true, name: true, driveFolderId: true }, orderBy: { name: "asc" } });
  return json({ items });
});
