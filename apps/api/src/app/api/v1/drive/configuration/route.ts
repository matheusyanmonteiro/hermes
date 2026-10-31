import { googleDriveConfigurationSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { apiRoute, json, parseJson } from "@/lib/http";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  const item = await prisma.googleDriveConfiguration.findUnique({ where: { id: "default" }, select: { clientId: true, redirectUri: true, updatedAt: true } });
  return json({ configured: Boolean(item), ...item });
});

export const PUT = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.DRIVE_MANAGE);
  const input = googleDriveConfigurationSchema.parse(await parseJson(request));
  const item = await prisma.googleDriveConfiguration.upsert({
    where: { id: "default" },
    update: { clientId: input.clientId, clientSecretEncrypted: encryptSecret(input.clientSecret), redirectUri: input.redirectUri },
    create: { id: "default", clientId: input.clientId, clientSecretEncrypted: encryptSecret(input.clientSecret), redirectUri: input.redirectUri },
    select: { clientId: true, redirectUri: true, updatedAt: true },
  });
  return json({ configured: true, ...item });
});
