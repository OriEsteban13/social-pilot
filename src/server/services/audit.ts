import { prisma } from "@/server/db/client";
import { jsonRecord } from "@/lib/json";

export async function logAudit(params: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? jsonRecord(params.metadata) : undefined,
    },
  });
}
