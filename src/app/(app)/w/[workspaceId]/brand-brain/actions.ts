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
import { isSupabaseStorageConfigured, uploadPublicAsset } from "@/server/storage/supabase-storage";

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

const UPLOADABLE_ASSET_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadBrandAssetFileAction(
  workspaceId: string,
  type: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);

  if (!isSupabaseStorageConfigured()) {
    return { ok: false, error: "La subida de archivos no está disponible (Supabase Storage no configurado). Usa el campo de URL en su lugar." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No se ha recibido ningún archivo." };
  }
  if (file.size > UPLOADABLE_ASSET_MAX_BYTES) {
    return { ok: false, error: "El archivo supera el tamaño máximo permitido (5 MB)." };
  }
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return { ok: false, error: "Solo se admiten imágenes (PNG, JPG, SVG...) o PDF." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "png");
  const url = await uploadPublicAsset({ data: buffer, contentType: file.type, extension, folder: "brand-assets" });

  await addBrandAsset(workspaceId, { type, name: file.name, url });
  revalidatePath(`/w/${workspaceId}/brand-brain`);
  return { ok: true };
}
