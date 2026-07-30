"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { createMediaAsset, deleteMediaAsset } from "@/server/services/library";
import type { MediaType } from "@/lib/enums";

export async function addMediaAssetAction(workspaceId: string, type: MediaType, url: string, folder?: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await createMediaAsset(workspaceId, { type, url, folder });
  revalidatePath(`/w/${workspaceId}/library`);
}

export async function deleteMediaAssetAction(workspaceId: string, mediaAssetId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await deleteMediaAsset(mediaAssetId);
  revalidatePath(`/w/${workspaceId}/library`);
}
