"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { createCampaign, updateCampaignStatus } from "@/server/services/campaigns";

export async function createCampaignAction(workspaceId: string, name: string, goal?: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await createCampaign(workspaceId, { name, goal });
  revalidatePath(`/w/${workspaceId}/campaigns`);
}

export async function updateCampaignStatusAction(workspaceId: string, campaignId: string, status: "ACTIVE" | "PAUSED" | "FINISHED") {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await updateCampaignStatus(campaignId, status);
  revalidatePath(`/w/${workspaceId}/campaigns`);
}
