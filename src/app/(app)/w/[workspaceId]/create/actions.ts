"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { createBlankContentItem, generateAllPlatformVariants, generateVariantForPlatform, adjustVariantBody, scoreVariant, attachMediaToVariant } from "@/server/services/content";
import { requestApproval, approveContentItemsDirectly } from "@/server/services/approvals";
import { scheduleVariant } from "@/server/services/calendar";
import { getImageProvider, getVideoProvider } from "@/server/media/registry";
import { buildBrandContext } from "@/server/services/brand-brain";
import { parseIdeasWorkbook, importIdeasFromRows } from "@/server/services/bulk-import";
import { prisma } from "@/server/db/client";
import { toStringArray } from "@/lib/json";
import type { AdjustInstruction } from "@/server/ai/types";
import type { ContentFormat, SocialPlatform } from "@/lib/enums";

export async function createFromBriefAction(workspaceId: string, brief: string, platforms: SocialPlatform[], language?: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);

  const title = brief.length > 80 ? `${brief.slice(0, 77)}...` : brief;
  const item = await createBlankContentItem(workspaceId, title, user.id);
  await generateAllPlatformVariants(item.id, brief, platforms, language);

  redirect(`/w/${workspaceId}/create/${item.id}`);
}

export async function importIdeasFromFileAction(workspaceId: string, formData: FormData): Promise<{ created: number; errors: string[] }> {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { created: 0, errors: ["No se ha recibido ningún archivo."] };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { created: 0, errors: ["El archivo supera el tamaño máximo permitido (2 MB)."] };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseIdeasWorkbook(buffer);
  const { created } = await importIdeasFromRows(workspaceId, rows);

  if (created > 0) revalidatePath(`/w/${workspaceId}/ideas`);
  return { created, errors };
}

export async function generateVariantAction(
  workspaceId: string,
  contentItemId: string,
  platform: SocialPlatform,
  format: ContentFormat,
  brief: string
) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await generateVariantForPlatform({ contentItemId, platform, format, brief });
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
}

export async function adjustVariantAction(workspaceId: string, contentItemId: string, variantId: string, instruction: AdjustInstruction) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await adjustVariantBody(variantId, instruction);
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
}

export async function rescoreVariantAction(workspaceId: string, contentItemId: string, variantId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const result = await scoreVariant(variantId);
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
  return result;
}

export async function generateImageForVariantAction(workspaceId: string, contentItemId: string, variantId: string, headline: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);

  const [brand, profile] = await Promise.all([
    buildBrandContext(workspaceId),
    prisma.brandProfile.findUnique({ where: { workspaceId } }),
  ]);
  const brandColors = toStringArray(profile?.brandColors as never);

  const provider = getImageProvider();
  const image = await provider.generateImage({
    prompt: headline,
    aspectRatio: "1:1",
    headline,
    brandName: brand.workspaceName,
    brandColors: brandColors.length ? brandColors : ["#6366f1", "#0ea5e9"],
  });

  const mediaAsset = await prisma.mediaAsset.create({
    data: {
      workspaceId,
      type: "IMAGE",
      url: image.url,
      width: image.width,
      height: image.height,
      sourceGenerator: `image-provider:${image.provider}`,
      folder: "content-engine",
    },
  });

  await attachMediaToVariant(variantId, mediaAsset.id);
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
}

export async function generateVideoForVariantAction(
  workspaceId: string,
  contentItemId: string,
  variantId: string,
  brief: string
): Promise<{ status: "VIDEO_READY" | "SCRIPT_READY"; script: string }> {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);

  const [variant, brand, profile] = await Promise.all([
    prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } }),
    buildBrandContext(workspaceId),
    prisma.brandProfile.findUnique({ where: { workspaceId } }),
  ]);
  const brandColors = toStringArray(profile?.brandColors as never);
  const aspectRatio = variant.platform === "TIKTOK" || variant.platform === "INSTAGRAM" ? "9:16" : "16:9";

  const provider = getVideoProvider();
  const result = await provider.generateVideo({
    brief,
    brandName: brand.workspaceName,
    brandColors: brandColors.length ? brandColors : ["#6366f1", "#0ea5e9"],
    durationSeconds: 8,
    aspectRatio,
  });

  if (result.status === "VIDEO_READY" && result.videoUrl) {
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        workspaceId,
        type: "VIDEO",
        url: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        durationSeconds: result.storyboard[0]?.durationSeconds,
        sourceGenerator: `video-provider:${result.provider}`,
        folder: "content-engine",
      },
    });
    await attachMediaToVariant(variantId, mediaAsset.id);
    revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
  }

  return { status: result.status, script: result.script };
}

export async function sendToApprovalAction(workspaceId: string, contentItemId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await requestApproval({ workspaceId, contentItemIds: [contentItemId], scope: "ITEM", requestedById: user.id });
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
}

export async function approveContentDirectAction(workspaceId: string, contentItemId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await approveContentItemsDirectly(workspaceId, [contentItemId], user.id);
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
}

export async function scheduleContentAction(workspaceId: string, contentItemId: string, variantId: string, when: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await scheduleVariant({ workspaceId, contentItemId, contentVariantId: variantId, scheduledAt: new Date(when) });
  revalidatePath(`/w/${workspaceId}/create/${contentItemId}`);
  revalidatePath(`/w/${workspaceId}/calendar`);
}
