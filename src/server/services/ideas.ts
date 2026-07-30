import { prisma } from "@/server/db/client";
import { getAIProvider } from "@/server/ai/registry";
import { buildBrandContext } from "./brand-brain";
import { createContentFromIdea } from "./content";
import { createBlogArticleFromIdea } from "./blog";
import { logAudit } from "./audit";
import type { ContentKind, IdeaStatus } from "@/lib/enums";

export async function listIdeas(workspaceId: string, status?: IdeaStatus) {
  return prisma.contentIdea.findMany({
    where: { workspaceId, ...(status ? { status } : {}) },
    include: { pillar: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function generateIdeas(params: {
  workspaceId: string;
  count?: number;
  sourceHint?: string;
  goals?: string[];
  contentKind?: ContentKind;
  language?: string;
}) {
  const { workspaceId, count = 6, sourceHint, goals, contentKind = "SOCIAL_POST", language } = params;
  const brand = await buildBrandContext(workspaceId);
  if (language) brand.language = language;
  const existingTitles = (
    await prisma.contentIdea.findMany({ where: { workspaceId }, select: { title: true } })
  ).map((i) => i.title);

  const provider = getAIProvider();
  const drafts = await provider.generateIdeas({
    brand,
    count,
    sourceHint,
    goals,
    excludeTitles: existingTitles,
    contentKind,
  });

  const pillars = await prisma.contentPillar.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const pillarIdByName = new Map(pillars.map((p) => [p.name, p.id]));

  const created = await prisma.$transaction(
    drafts.map((draft) =>
      prisma.contentIdea.create({
        data: {
          workspaceId,
          title: draft.title,
          description: draft.description,
          goal: draft.goal,
          audience: draft.audience,
          recommendedPlatform: draft.recommendedPlatform,
          recommendedFormat: draft.recommendedFormat,
          priority: draft.priority,
          rationale: draft.rationale,
          cta: draft.cta,
          sourceType: draft.sourceType,
          contentKind: draft.contentKind,
          // Se guarda el idioma REAL en el que el proveedor redactó el
          // título/descripción (`effectiveLanguage`, no `brand.language`):
          // un proveedor en modo plantilla puede haber caído al idioma real
          // del Brand Brain si no coincidía con el pedido — nunca se deja
          // `null`, para que más adelante, al generar el post/artículo a
          // partir de esta idea, se sepa con certeza en qué idioma está
          // escrita y no se mezcle con un idioma distinto si el idioma por
          // defecto del workspace cambia entretanto.
          language: draft.effectiveLanguage,
          pillarId: draft.pillarName ? pillarIdByName.get(draft.pillarName) : undefined,
        },
      })
    )
  );

  await logAudit({
    workspaceId,
    action: "ideas.generated",
    entityType: "ContentIdea",
    metadata: { count: created.length, sourceHint, contentKind },
  });

  return created;
}

export async function saveIdea(ideaId: string) {
  return prisma.contentIdea.update({ where: { id: ideaId }, data: { status: "SAVED" } });
}

export async function rejectIdea(ideaId: string) {
  return prisma.contentIdea.update({ where: { id: ideaId }, data: { status: "REJECTED" } });
}

export async function convertIdeaToContent(ideaId: string, userId?: string) {
  const idea = await prisma.contentIdea.findUniqueOrThrow({ where: { id: ideaId } });

  const created =
    idea.contentKind === "BLOG_ARTICLE" ? await createBlogArticleFromIdea(idea, userId) : await createContentFromIdea(idea, userId);

  await prisma.contentIdea.update({ where: { id: ideaId }, data: { status: "CONVERTED" } });
  return { ...created, contentKind: idea.contentKind as ContentKind };
}
