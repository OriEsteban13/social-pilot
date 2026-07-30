import { prisma } from "@/server/db/client";
import { logAudit } from "./audit";
import type { SocialPlatform } from "@/lib/enums";

export async function listCalendarEntries(workspaceId: string, range: { from: Date; to: Date }) {
  return prisma.calendarEntry.findMany({
    where: { workspaceId, scheduledAt: { gte: range.from, lte: range.to } },
    include: {
      contentItem: { include: { pillar: true, campaign: true } },
      contentVariant: { include: { mediaAssets: true } },
      socialAccount: true,
      campaign: true,
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function scheduleVariant(params: {
  workspaceId: string;
  contentItemId: string;
  contentVariantId: string;
  socialAccountId?: string;
  scheduledAt: Date;
  campaignId?: string;
}) {
  const entry = await prisma.calendarEntry.upsert({
    where: { contentVariantId: params.contentVariantId },
    create: {
      workspaceId: params.workspaceId,
      contentItemId: params.contentItemId,
      contentVariantId: params.contentVariantId,
      socialAccountId: params.socialAccountId,
      campaignId: params.campaignId,
      scheduledAt: params.scheduledAt,
      status: "SCHEDULED",
    },
    update: {
      scheduledAt: params.scheduledAt,
      socialAccountId: params.socialAccountId,
      status: "SCHEDULED",
    },
  });

  await prisma.contentItem.update({ where: { id: params.contentItemId }, data: { status: "SCHEDULED" } });

  return entry;
}

export async function rescheduleEntry(entryId: string, newDate: Date, userId?: string) {
  const entry = await prisma.calendarEntry.update({
    where: { id: entryId },
    data: { scheduledAt: newDate },
  });

  await logAudit({
    workspaceId: entry.workspaceId,
    userId,
    action: "calendar.entry_moved",
    entityType: "CalendarEntry",
    entityId: entryId,
    metadata: { newDate: newDate.toISOString() },
  });

  return entry;
}

export interface BalanceSuggestion {
  message: string;
  conflictEntryId: string;
  suggestedDate: string;
}

/**
 * Heurística simple de "drag & drop inteligente": si dos publicaciones
 * consecutivas (por fecha) del mismo pilar de contenido caen seguidas,
 * sugiere mover una de ellas dos días más tarde para mantener el equilibrio
 * editorial. Devuelve `null` si no detecta desequilibrio.
 */
export async function checkCalendarBalance(workspaceId: string, aroundDate: Date): Promise<BalanceSuggestion | null> {
  const from = new Date(aroundDate);
  from.setDate(from.getDate() - 3);
  const to = new Date(aroundDate);
  to.setDate(to.getDate() + 3);

  const entries = await prisma.calendarEntry.findMany({
    where: { workspaceId, scheduledAt: { gte: from, lte: to }, status: { in: ["SCHEDULED", "APPROVED", "PENDING_REVIEW"] } },
    include: { contentItem: { include: { pillar: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    const currentPillar = current.contentItem.pillar?.name;
    const nextPillar = next.contentItem.pillar?.name;
    const sameDay = current.scheduledAt.toDateString() !== next.scheduledAt.toDateString();
    const isCommercialPillar = (name?: string | null) => Boolean(name && /producto|comercial|lanzamiento/i.test(name));

    if (currentPillar && currentPillar === nextPillar && isCommercialPillar(currentPillar) && sameDay) {
      const suggested = new Date(next.scheduledAt);
      suggested.setDate(suggested.getDate() + 2);
      return {
        message: `Había dos publicaciones consecutivas del pilar "${currentPillar}". Mover "${next.contentItem.title}" dos días más tarde mantiene el equilibrio editorial.`,
        conflictEntryId: next.id,
        suggestedDate: suggested.toISOString(),
      };
    }
  }

  return null;
}

export async function removeCalendarEntry(entryId: string) {
  return prisma.calendarEntry.delete({ where: { id: entryId } });
}

export function defaultFrequencyPlan(): { platform: SocialPlatform; timesPerWeek: number }[] {
  return [
    { platform: "LINKEDIN", timesPerWeek: 3 },
    { platform: "INSTAGRAM", timesPerWeek: 2 },
    { platform: "TIKTOK", timesPerWeek: 1 },
    { platform: "THREADS", timesPerWeek: 1 },
    { platform: "X", timesPerWeek: 1 },
  ];
}
