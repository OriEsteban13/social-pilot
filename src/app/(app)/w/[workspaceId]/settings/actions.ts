"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { jsonArray } from "@/lib/json";
import { logAudit } from "@/server/services/audit";

export async function updateWorkspaceSettingsAction(
  workspaceId: string,
  input: { name: string; website?: string; industry?: string; country?: string; languages: string[]; timezone?: string }
) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: input.name,
      website: input.website,
      industry: input.industry,
      country: input.country,
      languages: jsonArray(input.languages),
      timezone: input.timezone,
    },
  });

  await logAudit({ workspaceId, userId: user.id, action: "workspace.settings_updated", entityType: "Workspace", entityId: workspaceId });
  revalidatePath(`/w/${workspaceId}/settings`);
}

export async function updateMetricoolBlogIdAction(workspaceId: string, metricoolBlogId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { metricoolBlogId: metricoolBlogId.trim() || null },
  });

  await logAudit({ workspaceId, userId: user.id, action: "workspace.metricool_blog_id_updated", entityType: "Workspace", entityId: workspaceId });
  revalidatePath(`/w/${workspaceId}/settings`);
  revalidatePath(`/w/${workspaceId}/accounts`);
}
