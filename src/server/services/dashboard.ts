import { prisma } from "@/server/db/client";
import { getPerformanceSummary } from "./analytics";
import { getWorkspaceStatus } from "./workspace";

export async function getWorkspaceDashboard(workspaceId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    status,
    todaysEntries,
    pendingApprovalCount,
    newIdeasCount,
    nextEntry,
    errorEntries,
    performance,
  ] = await Promise.all([
    getWorkspaceStatus(workspaceId),
    prisma.calendarEntry.findMany({
      where: { workspaceId, scheduledAt: { gte: startOfDay, lte: endOfDay } },
      include: { contentVariant: true, contentItem: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.contentItem.count({ where: { workspaceId, status: "PENDING_REVIEW" } }),
    prisma.contentIdea.count({ where: { workspaceId, status: "NEW" } }),
    prisma.calendarEntry.findFirst({
      where: { workspaceId, scheduledAt: { gt: now }, status: { in: ["SCHEDULED", "APPROVED", "PENDING_REVIEW"] } },
      include: { contentVariant: true, contentItem: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.contentItem.findMany({
      where: { workspaceId, status: "ERROR" },
      include: { variants: true },
      take: 5,
    }),
    getPerformanceSummary(workspaceId, 30),
  ]);

  return {
    status,
    todaysEntries,
    pendingApprovalCount,
    newIdeasCount,
    nextEntry,
    errorEntries,
    performance,
  };
}
