import { prisma } from "@/server/db/client";

export async function listCampaigns(workspaceId: string) {
  return prisma.campaign.findMany({
    where: { workspaceId },
    include: { _count: { select: { contentItems: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCampaign(workspaceId: string, input: { name: string; goal?: string; startDate?: Date; endDate?: Date }) {
  return prisma.campaign.create({ data: { workspaceId, ...input } });
}

export async function updateCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED" | "FINISHED") {
  return prisma.campaign.update({ where: { id: campaignId }, data: { status } });
}
