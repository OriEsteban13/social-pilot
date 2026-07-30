"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import {
  updateBrandProfile,
  createPillar,
  deletePillar,
  addWebsiteSource,
  analyzeWebsiteSource,
  addBrandAsset,
  type UpdateBrandProfileInput,
} from "@/server/services/brand-brain";

export async function updateBrandProfileAction(workspaceId: string, input: UpdateBrandProfileInput) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await updateBrandProfile(workspaceId, user.id, input);
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}

export async function addPillarAction(workspaceId: string, name: string, description?: string, color?: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await createPillar(workspaceId, { name, description, color });
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}

export async function deletePillarAction(workspaceId: string, pillarId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await deletePillar(pillarId);
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}

export async function addWebsiteSourceAction(workspaceId: string, url: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const source = await addWebsiteSource(workspaceId, url);
  await analyzeWebsiteSource(source.id);
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}

export async function reanalyzeWebsiteSourceAction(workspaceId: string, sourceId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await analyzeWebsiteSource(sourceId);
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}

export async function addBrandAssetAction(workspaceId: string, type: string, name: string, url: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await addBrandAsset(workspaceId, { type, name, url });
  revalidatePath(`/w/${workspaceId}/brand-brain`);
}
