import { prisma } from "@/server/db/client";
import { getAIProvider } from "@/server/ai/registry";
import { buildBrandContext } from "./brand-brain";
import { logAudit } from "./audit";
import { jsonArray } from "@/lib/json";
import type { BlogArticleStatus } from "@/lib/enums";
import type { ContentIdea } from "@/generated/prisma/client";

/**
 * Artículos de blog para la web de la empresa — un tipo de contenido
 * paralelo a las publicaciones sociales (ContentItem/ContentVariant), sin
 * límite de caracteres y sin adaptador de publicación: no hay integración
 * con ningún CMS todavía, así que "aprobar" deja el artículo listo para que
 * el equipo lo copie a su web, y "PUBLISHED" se marca manualmente. Ver
 * INTEGRATIONS.md.
 */

export async function listBlogArticles(workspaceId: string, status?: BlogArticleStatus) {
  return prisma.blogArticle.findMany({
    where: { workspaceId, ...(status ? { status } : {}) },
    include: { pillar: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBlogArticle(blogArticleId: string) {
  return prisma.blogArticle.findUnique({
    where: { id: blogArticleId },
    include: { pillar: true, idea: true },
  });
}

export async function createBlogArticleFromIdea(idea: ContentIdea, ownerId?: string) {
  return prisma.blogArticle.create({
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

export async function createBlankBlogArticle(workspaceId: string, title: string, ownerId?: string) {
  return prisma.blogArticle.create({
    data: { workspaceId, title, status: "DRAFT", ownerId },
  });
}

export async function generateBlogArticleDraft(blogArticleId: string, brief: string) {
  const article = await prisma.blogArticle.findUniqueOrThrow({ where: { id: blogArticleId }, include: { pillar: true, idea: true } });
  const brand = await buildBrandContext(article.workspaceId);
  if (article.idea?.language) brand.language = article.idea.language;
  const provider = getAIProvider();

  const draft = await provider.generateBlogArticle({
    brand,
    brief,
    briefLanguage: article.idea?.language ?? undefined,
    pillarName: article.pillar?.name,
  });

  const updated = await prisma.blogArticle.update({
    where: { id: blogArticleId },
    data: {
      title: draft.title,
      metaDescription: draft.metaDescription,
      body: draft.body,
      tags: jsonArray(draft.tags),
      cta: draft.cta,
      wordCount: countWords(draft.body),
      needsValidation: draft.needsValidation,
      status: "PENDING_REVIEW",
    },
  });

  await logAudit({
    workspaceId: article.workspaceId,
    action: "blog_article.generated",
    entityType: "BlogArticle",
    entityId: blogArticleId,
    metadata: { brief },
  });

  return updated;
}

export async function updateBlogArticle(
  blogArticleId: string,
  data: { title?: string; body?: string; metaDescription?: string; cta?: string }
) {
  return prisma.blogArticle.update({
    where: { id: blogArticleId },
    data: { ...data, ...(data.body !== undefined ? { wordCount: countWords(data.body) } : {}) },
  });
}

export async function setBlogArticleStatus(blogArticleId: string, status: BlogArticleStatus, userId?: string) {
  const article = await prisma.blogArticle.update({
    where: { id: blogArticleId },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
  });

  await logAudit({
    workspaceId: article.workspaceId,
    userId,
    action: "blog_article.status_changed",
    entityType: "BlogArticle",
    entityId: blogArticleId,
    metadata: { status },
  });

  return article;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
