import { prisma } from "@/server/db/client";
import { logAudit } from "./audit";
import { notify } from "./notifications";
import { enqueueScheduledPost } from "./publishing";
import type { ApprovalScope } from "@/lib/enums";

export async function requestApproval(params: {
  workspaceId: string;
  contentItemIds: string[];
  scope: ApprovalScope;
  requestedById?: string;
  rangeStart?: Date;
  rangeEnd?: Date;
}) {
  const approval = await prisma.approval.create({
    data: {
      workspaceId: params.workspaceId,
      scope: params.scope,
      status: "PENDING",
      requestedById: params.requestedById,
      rangeStart: params.rangeStart,
      rangeEnd: params.rangeEnd,
      targets: { create: params.contentItemIds.map((contentItemId) => ({ contentItemId })) },
    },
    include: { targets: true },
  });

  await prisma.contentItem.updateMany({
    where: { id: { in: params.contentItemIds } },
    data: { status: "PENDING_REVIEW" },
  });

  await notify({
    workspaceId: params.workspaceId,
    type: "approval.requested",
    title: params.scope === "ITEM" ? "Nueva publicación pendiente de aprobación" : `Contenido de ${params.scope === "WEEK" ? "la semana" : "el mes"} listo para aprobar`,
    body: `${params.contentItemIds.length} publicación(es) esperando revisión.`,
  });

  return approval;
}

export async function listPendingApprovals(workspaceId: string) {
  return prisma.approval.findMany({
    where: { workspaceId, status: "PENDING" },
    include: { targets: { include: { contentItem: { include: { variants: true, pillar: true, calendarEntry: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function decideApproval(params: {
  approvalId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  decidedById?: string;
  comment?: string;
}) {
  const approval = await prisma.approval.update({
    where: { id: params.approvalId },
    data: { status: params.decision, decidedById: params.decidedById, decidedAt: new Date() },
    include: { targets: { include: { contentItem: { include: { calendarEntry: true } } } } },
  });

  const newContentStatus =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "CANCELLED";

  for (const target of approval.targets) {
    await prisma.contentItem.update({ where: { id: target.contentItemId }, data: { status: newContentStatus } });

    if (params.decision === "APPROVED" && target.contentItem.calendarEntry) {
      await prisma.calendarEntry.update({
        where: { id: target.contentItem.calendarEntry.id },
        data: { status: "SCHEDULED" },
      });
      await enqueueScheduledPost(target.contentItem.calendarEntry.id);
    }
  }

  if (params.comment) {
    await prisma.comment.create({
      data: { approvalId: approval.id, authorId: params.decidedById ?? "system", body: params.comment },
    });
  }

  await logAudit({
    workspaceId: approval.workspaceId,
    userId: params.decidedById,
    action: `approval.${params.decision.toLowerCase()}`,
    entityType: "Approval",
    entityId: approval.id,
    metadata: { itemCount: approval.targets.length },
  });

  return approval;
}

export async function approveContentItemsDirectly(workspaceId: string, contentItemIds: string[], userId?: string) {
  const approval = await requestApproval({ workspaceId, contentItemIds, scope: contentItemIds.length > 1 ? "WEEK" : "ITEM", requestedById: userId });
  return decideApproval({ approvalId: approval.id, decision: "APPROVED", decidedById: userId });
}
