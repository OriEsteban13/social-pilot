import { prisma } from "@/server/db/client";
import { jsonArray, toJsonArray, toStringArray } from "@/lib/json";
import type { BrandContext } from "@/server/ai/types";
import type { Tone } from "@/lib/enums";
import { getAIProvider } from "@/server/ai/registry";
import { normalizeUrl } from "@/server/ai/website-fetch";
import { logAudit } from "./audit";

export async function getBrandProfile(workspaceId: string) {
  return prisma.brandProfile.findUnique({ where: { workspaceId } });
}

export async function getPillars(workspaceId: string) {
  return prisma.contentPillar.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}

export async function buildBrandContext(workspaceId: string): Promise<BrandContext> {
  const [workspace, profile, pillars] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    prisma.brandProfile.findUnique({ where: { workspaceId } }),
    getPillars(workspaceId),
  ]);

  return {
    workspaceName: workspace.name,
    website: workspace.website,
    industry: workspace.industry,
    language: workspace.defaultLanguage,
    nativeLanguage: workspace.defaultLanguage,
    description: profile?.description ?? null,
    valueProposition: profile?.valueProposition ?? null,
    tone: (profile?.tone as Tone) ?? "CERCANO",
    toneCustom: profile?.toneCustom ?? null,
    targetAudiences: toStringArray(profile?.targetAudiences as never),
    differentiators: toStringArray(profile?.differentiators as never),
    claims: toStringArray(profile?.claims as never),
    allowedTerms: toStringArray(profile?.allowedTerms as never),
    forbiddenTerms: toStringArray(profile?.forbiddenTerms as never),
    pillars: pillars.map((p) => ({ id: p.id, name: p.name, description: p.description })),
  };
}

export interface UpdateBrandProfileInput {
  description?: string;
  valueProposition?: string;
  tone?: Tone;
  toneCustom?: string;
  targetAudiences?: string[];
  differentiators?: string[];
  claims?: string[];
  allowedTerms?: string[];
  forbiddenTerms?: string[];
  brandColors?: string[];
  brandFonts?: string[];
  competitors?: string[];
  authorizedClients?: string[];
  writingStyleNotes?: string;
}

export async function updateBrandProfile(workspaceId: string, userId: string, input: UpdateBrandProfileInput) {
  const data: Record<string, unknown> = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.valueProposition !== undefined) data.valueProposition = input.valueProposition;
  if (input.tone !== undefined) data.tone = input.tone;
  if (input.toneCustom !== undefined) data.toneCustom = input.toneCustom;
  if (input.writingStyleNotes !== undefined) data.writingStyleNotes = input.writingStyleNotes;
  if (input.targetAudiences) data.targetAudiences = jsonArray(input.targetAudiences);
  if (input.differentiators) data.differentiators = jsonArray(input.differentiators);
  if (input.claims) data.claims = jsonArray(input.claims);
  if (input.allowedTerms) data.allowedTerms = jsonArray(input.allowedTerms);
  if (input.forbiddenTerms) data.forbiddenTerms = jsonArray(input.forbiddenTerms);
  if (input.brandColors) data.brandColors = jsonArray(input.brandColors);
  if (input.brandFonts) data.brandFonts = jsonArray(input.brandFonts);
  if (input.competitors) data.competitors = jsonArray(input.competitors);
  if (input.authorizedClients) data.authorizedClients = jsonArray(input.authorizedClients);

  const profile = await prisma.brandProfile.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  });

  await logAudit({ workspaceId, userId, action: "brand_brain.updated", entityType: "BrandProfile", entityId: profile.id });
  return profile;
}

export async function createPillar(workspaceId: string, input: { name: string; description?: string; color?: string; targetSharePct?: number }) {
  return prisma.contentPillar.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description,
      color: input.color,
      targetSharePct: input.targetSharePct,
    },
  });
}

export async function deletePillar(pillarId: string) {
  return prisma.contentPillar.delete({ where: { id: pillarId } });
}

export async function addWebsiteSource(workspaceId: string, url: string) {
  // Normaliza (añade "https://" si el usuario escribió solo "tuweb.com") para
  // que el enlace mostrado en la UI y la petición de análisis usen siempre
  // una URL absoluta válida — si no se puede normalizar, se guarda tal cual
  // y el análisis fallará con un error explicativo en vez de romper aquí.
  return prisma.websiteSource.create({ data: { workspaceId, url: normalizeUrl(url) ?? url } });
}

export async function analyzeWebsiteSource(sourceId: string) {
  const source = await prisma.websiteSource.findUniqueOrThrow({ where: { id: sourceId } });
  const provider = getAIProvider();
  const analysis = await provider.analyzeWebsite(source.url);

  await prisma.websiteSource.update({
    where: { id: sourceId },
    data: {
      status: analysis.needsValidation ? "ERROR" : "CRAWLED",
      lastCrawledAt: new Date(),
      extractedSummary: analysis.summary,
      extractedTopics: jsonArray(analysis.keyMessages),
    },
  });

  return analysis;
}

export async function listWebsiteSources(workspaceId: string) {
  return prisma.websiteSource.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function listDocumentSources(workspaceId: string) {
  return prisma.documentSource.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function addBrandAsset(workspaceId: string, input: { type: string; name: string; url: string }) {
  return prisma.brandAsset.create({ data: { workspaceId, ...input } });
}

export async function listBrandAssets(workspaceId: string) {
  return prisma.brandAsset.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export function parseFaqs(profile: { faqs: unknown } | null): { question: string; answer: string }[] {
  return toJsonArray(profile?.faqs as never);
}
