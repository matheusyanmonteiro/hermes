import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { getCurrentCampaign } from "@/lib/campaign";
import { ApiError } from "@/lib/errors";
import { apiRoute, correlationId, json } from "@/lib/http";

export const POST = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.CAMPAIGN_MANAGE);
  const current = await getCurrentCampaign();
  if (!current) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada");
  const campaign = await prisma.campaign.update({ where: { id: current.id }, data: { status: "CLOSED", closedAt: new Date(), endsAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: auth.user.id, action: "campaign.closed", resourceType: "campaign", resourceId: campaign.id, correlationId: correlationId(request) } });
  return json(campaign);
});
