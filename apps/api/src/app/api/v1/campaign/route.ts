import { campaignSchema } from "@hermes/contracts";
import { prisma } from "@hermes/database";
import { PERMISSIONS } from "@hermes/permissions";
import { authenticate, requirePermission } from "@/lib/auth";
import { getCurrentCampaign } from "@/lib/campaign";
import { apiRoute, correlationId, json, parseJson } from "@/lib/http";

export const GET = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.CAMPAIGN_VIEW);
  const campaign = await getCurrentCampaign();
  return json(campaign);
});

export const PUT = apiRoute(async (request) => {
  const auth = await authenticate(request);
  requirePermission(auth, PERMISSIONS.CAMPAIGN_MANAGE);
  const input = campaignSchema.parse(await parseJson(request));
  const current = await getCurrentCampaign();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const status = startsAt > new Date() ? "SCHEDULED" : endsAt > new Date() ? "ACTIVE" : "CLOSED";
  const campaign = current
    ? await prisma.campaign.update({ where: { id: current.id }, data: { ...input, startsAt, endsAt, status, closedAt: status === "CLOSED" ? new Date() : null } })
    : await prisma.campaign.create({ data: { ...input, startsAt, endsAt, status } });
  await prisma.auditLog.create({ data: { actorId: auth.user.id, action: "campaign.updated", resourceType: "campaign", resourceId: campaign.id, after: { name: campaign.name, startsAt: campaign.startsAt.toISOString(), endsAt: campaign.endsAt.toISOString(), status }, correlationId: correlationId(request) } });
  return json(campaign);
});
