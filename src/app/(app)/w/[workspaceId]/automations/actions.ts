"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { createAutomation, toggleAutomation, deleteAutomation } from "@/server/services/automations";
import type { SocialPlatform } from "@/lib/enums";

export async function createAutomationAction(
  workspaceId: string,
  input: { name: string; trigger: string; frequency?: string; platforms: SocialPlatform[]; requiresApproval: boolean }
) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await createAutomation(workspaceId, input);
  revalidatePath(`/w/${workspaceId}/automations`);
}

export async function toggleAutomationAction(workspaceId: string, automationId: string, status: "ACTIVE" | "PAUSED") {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await toggleAutomation(automationId, status);
  revalidatePath(`/w/${workspaceId}/automations`);
}

export async function deleteAutomationAction(workspaceId: string, automationId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await deleteAutomation(automationId);
  revalidatePath(`/w/${workspaceId}/automations`);
}
