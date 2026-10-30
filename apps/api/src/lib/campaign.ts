import { prisma } from "@hermes/database";
import { ApiError } from "./errors";

export async function getCurrentCampaign() {
  return prisma.campaign.findFirst({ orderBy: { createdAt: "desc" } });
}

export async function requireActiveCampaign() {
  const campaign = await getCurrentCampaign();
  const now = new Date();
  if (!campaign || campaign.status === "CLOSED" || campaign.startsAt > now || campaign.endsAt <= now) {
    throw new ApiError(423, "CAMPAIGN_CLOSED", "A campanha não está aberta para novas transferências");
  }
  return campaign;
}
