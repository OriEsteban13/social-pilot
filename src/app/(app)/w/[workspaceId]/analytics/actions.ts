"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { syncAnalytics } from "@/server/services/analytics";

export async function syncAnalyticsAction(workspaceId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR", "VIEWER", "REVIEWER"]);
  const result = await syncAnalytics(workspaceId);
  revalidatePath(`/w/${workspaceId}/analytics`);
  revalidatePath(`/w/${workspaceId}`);
  return result;
}
