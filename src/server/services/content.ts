import { prisma } from "@/server/db/client";
import type { ContentIdea } from "@/generated/prisma/client";
import { jsonArray, toStringArray } from "@/lib/json";
import { getAIProvider } from "@/server/ai/registry";
import { buildBrandContext } from "./brand-brain";
import { logAudit } from "./audit";
import type { ContentFormat, SocialPlatform } from "@/lib/enums";
import type { AdjustInstruction } from "@/server/ai/types";

export async function createContentFromIdea(idea: ContentIdea, ownerId?: string) {
  return prisma.contentItem.create({
    data: {
      workspaceId: idea.workspaceId,
      ideaId: idea.id,
      pillarId: idea.pillarId,
      title: idea.title,
      status: "DRAFT",
      ownerId,
    },
  });
}

export async function createBlankContentItem(workspaceId: string, title: string, ownerId?: string) {
  return prisma.contentItem.create({
    data: { workspaceId, title, status: "DRAFT", ownerId },
  });
}

export async function listContentItems(workspaceId: string, filters?: { status?: string; campaignId?: string }) {
  return prisma.contentItem.findMany({
    where: { workspaceId, ...(filters?.status ? { status: filters.status } : {}), ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}) },
    include: { variants: true, calendarEntry: true, pillar: true, campaign: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getContentItem(contentItemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      variants: { include: { mediaAssets: true } },
      calendarEntry: true,
      pillar: true,
      campaign: true,
      idea: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateVariantForPlatform(params: {
  contentItemId: string;
  platform: SocialPlatform;
  format: ContentFormat;
  brief: string;
  campaignGoal?: string;
  language?: string;
}) {
  const contentItem = await prisma.contentItem.findUniqueOrThrow({ where: { id: params.contentItemId }, include: { idea: true } });
  const brand = await buildBrandContext(contentItem.workspaceId);
  const language = params.language ?? contentItem.idea?.language ?? undefined;
  if (language) brand.language = language;
  const provider = getAIProvider();

  const draft = await provider.generateVariant({
    brand,
    platform: params.platform,
    format: params.format,
    brief: params.brief,
    // Cuando el brief viene de una idea (p.ej. el botón "Generar para X" usa
    // el título de la idea como brief), su idioma real es el que se guardó
    // en esa idea — puede no coincidir con `language` si el idioma por
    // defecto del workspace cambió después de crearla. Sin idea asociada
    // (brief recién escrito a mano en "Nuevo contenido") no hay señal fiable,
    // así que se deja sin definir.
    briefLanguage: contentItem.idea?.language ?? undefined,
    campaignGoal: params.campaignGoal,
  });

  const scoreResult = await provider.scoreContent(draft.body, params.platform, brand);

  const existing = await prisma.contentVariant.findFirst({
    where: { contentItemId: params.contentItemId, platform: params.platform },
  });

  const variant = existing
    ? await prisma.contentVariant.update({
        where: { id: existing.id },
        data: {
          format: params.format,
          body: draft.body,
          hashtags: jsonArray(draft.hashtags),
          cta: draft.cta,
          altText: draft.altText,
          charCount: draft.charCount,
          needsValidation: draft.needsValidation,
          language: brand.language,
        },
      })
    : await prisma.contentVariant.create({
        data: {
          contentItemId: params.contentItemId,
          platform: params.platform,
          format: params.format,
          body: draft.body,
          hashtags: jsonArray(draft.hashtags),
          cta: draft.cta,
          altText: draft.altText,
          charCount: draft.charCount,
          needsValidation: draft.needsValidation,
          language: brand.language,
        },
      });

  await prisma.contentItem.update({
    where: { id: params.contentItemId },
    data: { status: contentItem.status === "DRAFT" ? "PENDING_REVIEW" : contentItem.status, contentScore: scoreResult.score },
  });

  return { variant, score: scoreResult, scriptScenes: draft.scriptScenes };
}

export async function generateAllPlatformVariants(contentItemId: string, brief: string, platforms: SocialPlatform[], language?: string) {
  const defaultFormat: Record<SocialPlatform, ContentFormat> = {
    LINKEDIN: "POST",
    INSTAGRAM: "POST",
    TIKTOK: "VIDEO",
    THREADS: "POST",
    X: "POST",
  };

  const results = [];
  for (const platform of platforms) {
    results.push(
      await generateVariantForPlatform({
        contentItemId,
        platform,
        format: defaultFormat[platform],
        brief,
        language,
      })
    );
  }
  return results;
}

export async function adjustVariantBody(variantId: string, instruction: AdjustInstruction, options?: { targetTone?: string; targetLanguage?: string }) {
  const variant = await prisma.contentVariant.findUniqueOrThrow({
    where: { id: variantId },
    include: { contentItem: { select: { workspaceId: true } } },
  });
  // El idioma real de ESTE texto (guardado al generarlo) puede no coincidir
  // con el idioma por defecto ACTUAL del workspace — p.ej. se generó en
  // inglés puntualmente desde "Nuevo contenido" y el workspace sigue en
  // español por defecto. Usar el del workspace aquí mezclaría idiomas al
  // ajustar (regresión real: "Acortar"/"Más comercial" devolvían el texto en
  // español aunque el original estuviera en inglés). Solo se cae al idioma
  // del workspace para variantes anteriores a este campo (`language: null`).
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: variant.contentItem.workspaceId },
    select: { defaultLanguage: true },
  });
  const language = variant.language ?? workspace.defaultLanguage;
  const provider = getAIProvider();
  const newBody = await provider.adjustCopy({
    body: variant.body,
    instruction,
    platform: variant.platform as SocialPlatform,
    targetTone: options?.targetTone as never,
    targetLanguage: options?.targetLanguage,
    language,
  });

  // Si la instrucción traduce el texto, el idioma real del body cambia con
  // ella — hay que actualizar el campo para que el próximo ajuste no vuelva
  // a usar el idioma antiguo.
  const newLanguage = instruction === "TRANSLATE" && options?.targetLanguage ? options.targetLanguage : language;

  return prisma.contentVariant.update({
    where: { id: variantId },
    data: { body: newBody, charCount: newBody.length, language: newLanguage },
  });
}

export async function updateVariantBody(variantId: string, body: string) {
  return prisma.contentVariant.update({ where: { id: variantId }, data: { body, charCount: body.length } });
}

export async function attachMediaToVariant(variantId: string, mediaAssetId: string) {
  // `set` reemplaza la relación completa (en vez de `connect`, que solo
  // añade) — cada variante muestra un único medio "activo" a la vez, así que
  // regenerar imagen/vídeo debe sustituir el anterior, no acumularlo. Los
  // medios anteriores no se borran: quedan en la Biblioteca, solo se
  // desvinculan de esta variante.
  return prisma.contentVariant.update({
    where: { id: variantId },
    data: { mediaAssets: { set: [{ id: mediaAssetId }] } },
  });
}

export async function detachMediaFromVariant(variantId: string, mediaAssetId: string) {
  return prisma.contentVariant.update({
    where: { id: variantId },
    data: { mediaAssets: { disconnect: { id: mediaAssetId } } },
  });
}

export async function scoreVariant(variantId: string) {
  const variant = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId }, include: { contentItem: true } });
  const brand = await buildBrandContext(variant.contentItem.workspaceId);
  const provider = getAIProvider();
  const result = await provider.scoreContent(variant.body, variant.platform as SocialPlatform, brand);

  await prisma.contentItem.update({ where: { id: variant.contentItemId }, data: { contentScore: result.score } });
  return result;
}

export async function updateContentStatus(contentItemId: string, status: string, userId?: string) {
  const item = await prisma.contentItem.update({ where: { id: contentItemId }, data: { status } });
  await logAudit({
    workspaceId: item.workspaceId,
    userId,
    action: "content.status_changed",
    entityType: "ContentItem",
    entityId: contentItemId,
    metadata: { status },
  });
  return item;
}

export function variantHashtags(variant: { hashtags: unknown }): string[] {
  return toStringArray(variant.hashtags as never);
}

export async function addComment(contentItemId: string, authorId: string, body: string) {
  return prisma.comment.create({ data: { contentItemId, authorId, body } });
}
