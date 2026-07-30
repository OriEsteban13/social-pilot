"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { generateWeek, type GenerateWeekResult } from "@/server/services/automations";
import { updateAutomationLevel, updateDefaultLanguage } from "@/server/services/workspace";
import { decideApproval, approveContentItemsDirectly } from "@/server/services/approvals";
import { rescheduleEntry, checkCalendarBalance, type BalanceSuggestion } from "@/server/services/calendar";
import { updateVariantBody } from "@/server/services/content";
import { cancelScheduledPost } from "@/server/services/publishing";
import { prisma } from "@/server/db/client";
import type { AutomationLevel } from "@/lib/enums";

export async function generateWeekAction(workspaceId: string): Promise<GenerateWeekResult> {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const result = await generateWeek(workspaceId, user.id);
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/calendar`);
  return result;
}

export async function setAutomationLevelAction(workspaceId: string, level: AutomationLevel) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await updateAutomationLevel(workspaceId, user.id, level);
  revalidatePath(`/w/${workspaceId}`);
}

export async function setDefaultLanguageAction(workspaceId: string, language: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await updateDefaultLanguage(workspaceId, user.id, language);
  revalidatePath(`/w/${workspaceId}`);
}

export async function approveAllAction(workspaceId: string, contentItemIds: string[]) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await approveContentItemsDirectly(workspaceId, contentItemIds, user.id);
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/calendar`);
}

export async function decideApprovalAction(
  workspaceId: string,
  approvalId: string,
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  comment?: string
) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await decideApproval({ approvalId, decision, decidedById: user.id, comment });
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/calendar`);
}

export async function rescheduleEntryAction(workspaceId: string, entryId: string, newDate: string): Promise<BalanceSuggestion | null> {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const entry = await rescheduleEntry(entryId, new Date(newDate), user.id);
  const suggestion = await checkCalendarBalance(workspaceId, entry.scheduledAt);
  revalidatePath(`/w/${workspaceId}/calendar`);
  return suggestion;
}

export async function applyBalanceSuggestionAction(workspaceId: string, entryId: string, newDate: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await rescheduleEntry(entryId, new Date(newDate), user.id);
  revalidatePath(`/w/${workspaceId}/calendar`);
}

export async function quickApproveAction(workspaceId: string, contentItemId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await approveContentItemsDirectly(workspaceId, [contentItemId], user.id);
  revalidatePath(`/w/${workspaceId}/calendar`);
}

export async function updateVariantBodyAction(workspaceId: string, variantId: string, body: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await updateVariantBody(variantId, body);
  revalidatePath(`/w/${workspaceId}/calendar`);
}

export async function cancelCalendarEntryAction(workspaceId: string, entryId: string, contentItemId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await cancelScheduledPost(entryId).catch(() => undefined);
  await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: "CANCELLED" } });
  revalidatePath(`/w/${workspaceId}/calendar`);
}
