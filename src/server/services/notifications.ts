import { prisma } from "@/server/db/client";
import { jsonRecord } from "@/lib/json";
import type { NotificationChannel } from "@/lib/enums";

export async function notify(params: {
  workspaceId: string;
  userId?: string | null;
  type: string;
  title: string;
  body?: string;
  channel?: NotificationChannel;
  payload?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId ?? undefined,
      type: params.type,
      title: params.title,
      body: params.body,
      channel: params.channel ?? "IN_APP",
      payload: params.payload ? jsonRecord(params.payload) : undefined,
    },
  });
}

export async function listRecentNotifications(workspaceId: string, limit = 10) {
  return prisma.notification.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function countUnread(workspaceId: string) {
  return prisma.notification.count({ where: { workspaceId, readAt: null } });
}
