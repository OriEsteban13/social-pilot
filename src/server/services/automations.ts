import { prisma } from "@/server/db/client";
import { buildBrandContext } from "./brand-brain";
import { getAIProvider } from "@/server/ai/registry";
import { createContentFromIdea, generateVariantForPlatform, attachMediaToVariant } from "./content";
import { scheduleVariant } from "./calendar";
import { requestApproval, approveContentItemsDirectly } from "./approvals";
import { getImageProvider } from "@/server/media/registry";
import { logAudit } from "./audit";
import { jsonArray, jsonRecord, toStringArray } from "@/lib/json";
import type { AutomationLevel, ContentFormat, SocialPlatform } from "@/lib/enums";
import { defaultFrequencyPlan } from "./calendar";

const DEFAULT_SLOT_HOURS = [10, 13, 17];
const PLATFORM_DEFAULT_FORMAT: Record<SocialPlatform, ContentFormat> = {
  LINKEDIN: "POST",
  INSTAGRAM: "POST",
  TIKTOK: "VIDEO",
  THREADS: "POST",
  X: "POST",
};

export async function listAutomations(workspaceId: string) {
  return prisma.automation.findMany({
    where: { workspaceId },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAutomation(workspaceId: string, input: {
  name: string;
  trigger: string;
  frequency?: string;
  platforms: SocialPlatform[];
  requiresApproval: boolean;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
}) {
  return prisma.automation.create({
    data: {
      workspaceId,
      name: input.name,
      trigger: input.trigger,
      frequency: input.frequency,
      platforms: jsonArray(input.platforms),
      requiresApproval: input.requiresApproval,
      conditions: input.conditions ? jsonRecord(input.conditions) : undefined,
      actions: input.actions ? jsonRecord(input.actions) : undefined,
    },
  });
}

export async function toggleAutomation(automationId: string, status: "ACTIVE" | "PAUSED") {
  return prisma.automation.update({ where: { id: automationId }, data: { status } });
}

export async function deleteAutomation(automationId: string) {
  return prisma.automation.delete({ where: { id: automationId } });
}

function nextWeekdayDates(count: number, startFromNextMonday = true): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (startFromNextMonday) {
    const day = cursor.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    cursor.setDate(cursor.getDate() + daysUntilMonday);
  }

  while (dates.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export interface GenerateWeekResult {
  totalCreated: number;
  byPlatform: Record<string, number>;
  approvalId?: string;
  autoApproved: boolean;
}

/**
 * "Generate Week" / "Generate Next Month": genera automáticamente un lote de
 * contenido completo (idea → copy por plataforma → imagen → calendario) a
 * partir de la frecuencia configurada, y solicita una única aprobación en
 * bloque (o publica directamente en modo Autopilot). Ejecuta el flujo
 * completo descrito en el enunciado del producto para el botón principal
 * del calendario.
 */
export async function generateWeek(workspaceId: string, userId?: string): Promise<GenerateWeekResult> {
  const [workspace, brand] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    buildBrandContext(workspaceId),
  ]);

  const plan = defaultFrequencyPlan();
  const provider = getAIProvider();
  const imageProvider = getImageProvider();
  const brandColors = toStringArray(
    (await prisma.brandProfile.findUnique({ where: { workspaceId } }))?.brandColors as never
  );

  const createdContentItemIds: string[] = [];
  const byPlatform: Record<string, number> = {};

  for (const { platform, timesPerWeek } of plan) {
    const dates = nextWeekdayDates(timesPerWeek);
    for (let i = 0; i < dates.length; i++) {
      const ideaDrafts = await provider.generateIdeas({
        brand,
        count: 1,
        sourceHint: "generate-week",
      });
      const draft = ideaDrafts[0];
      if (!draft) continue;

      const idea = await prisma.contentIdea.create({
        data: {
          workspaceId,
          title: draft.title,
          description: draft.description,
          goal: draft.goal,
          audience: draft.audience,
          recommendedPlatform: platform,
          recommendedFormat: PLATFORM_DEFAULT_FORMAT[platform],
          priority: draft.priority,
          rationale: draft.rationale,
          cta: draft.cta,
          sourceType: "MANUAL",
          status: "CONVERTED",
        },
      });

      const contentItem = await createContentFromIdea(idea, userId);
      const { variant } = await generateVariantForPlatform({
        contentItemId: contentItem.id,
        platform,
        format: PLATFORM_DEFAULT_FORMAT[platform],
        brief: draft.title,
        campaignGoal: draft.goal,
      });

      const image = await imageProvider.generateImage({
        prompt: draft.title,
        aspectRatio: platform === "INSTAGRAM" || platform === "TIKTOK" ? "4:5" : "1.91:1",
        headline: draft.title,
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
          folder: "generate-week",
        },
      });
      await attachMediaToVariant(variant.id, mediaAsset.id);

      const scheduledAt = new Date(dates[i]);
      scheduledAt.setHours(DEFAULT_SLOT_HOURS[i % DEFAULT_SLOT_HOURS.length], 0, 0, 0);

      await scheduleVariant({
        workspaceId,
        contentItemId: contentItem.id,
        contentVariantId: variant.id,
        scheduledAt,
      });

      createdContentItemIds.push(contentItem.id);
      byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
    }
  }

  const level = workspace.automationLevel as AutomationLevel;
  let approvalId: string | undefined;
  let autoApproved = false;

  if (level === "AUTOPILOT") {
    await approveContentItemsDirectly(workspaceId, createdContentItemIds, userId);
    autoApproved = true;
  } else {
    const approval = await requestApproval({
      workspaceId,
      contentItemIds: createdContentItemIds,
      scope: "WEEK",
      requestedById: userId,
      rangeStart: nextWeekdayDates(1)[0],
    });
    approvalId = approval.id;
  }

  await logAudit({
    workspaceId,
    userId,
    action: "automation.generate_week",
    entityType: "CalendarEntry",
    metadata: { totalCreated: createdContentItemIds.length, byPlatform, autoApproved },
  });

  return { totalCreated: createdContentItemIds.length, byPlatform, approvalId, autoApproved };
}
