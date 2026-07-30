import { prisma } from "@/server/db/client";
import { jsonArray, toStringArray } from "@/lib/json";
import type { AutomationLevel, Role } from "@/lib/enums";
import { AUTOMATION_LEVEL_LABELS } from "@/lib/enums";
import { logAudit } from "./audit";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role as Role }));
}

export async function getWorkspace(workspaceId: string) {
  return prisma.workspace.findUnique({ where: { id: workspaceId } });
}

export async function getWorkspaceStatus(workspaceId: string): Promise<{
  label: string;
  tone: "autopilot" | "pending" | "manual" | "assisted";
}> {
  const [workspace, pendingApproval] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.approval.findFirst({ where: { workspaceId, status: "PENDING" } }),
  ]);

  if (!workspace) return { label: "—", tone: "manual" };

  if (pendingApproval) {
    return { label: "Pending Approval", tone: "pending" };
  }

  const level = workspace.automationLevel as AutomationLevel;
  if (level === "AUTOPILOT" || level === "AUTOPILOT_APPROVAL") {
    return { label: "Auto Pilot", tone: "autopilot" };
  }
  if (level === "MANUAL") {
    return { label: "Manual", tone: "manual" };
  }
  return { label: AUTOMATION_LEVEL_LABELS[level] ?? level, tone: "assisted" };
}

export async function createWorkspace(params: {
  ownerId: string;
  name: string;
  website?: string;
  industry?: string;
  country?: string;
  languages?: string[];
}) {
  const baseSlug = slugify(params.name) || "workspace";
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: params.name,
      slug,
      website: params.website,
      industry: params.industry,
      country: params.country,
      languages: jsonArray(params.languages ?? ["es"]),
      defaultLanguage: params.languages?.[0]?.trim().toLowerCase() || "es",
      memberships: {
        create: { userId: params.ownerId, role: "OWNER", acceptedAt: new Date() },
      },
      brandProfile: { create: {} },
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    userId: params.ownerId,
    action: "workspace.created",
    entityType: "Workspace",
    entityId: workspace.id,
  });

  return workspace;
}

export async function updateAutomationLevel(workspaceId: string, userId: string, level: AutomationLevel) {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { automationLevel: level },
  });
  await logAudit({
    workspaceId,
    userId,
    action: "workspace.automation_level_changed",
    entityType: "Workspace",
    entityId: workspaceId,
    metadata: { level },
  });
  return workspace;
}

export function workspaceLanguages(workspace: { languages: unknown }): string[] {
  return toStringArray(workspace.languages as never);
}

export async function updateDefaultLanguage(workspaceId: string, userId: string, language: string) {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { defaultLanguage: language },
  });
  await logAudit({
    workspaceId,
    userId,
    action: "workspace.default_language_changed",
    entityType: "Workspace",
    entityId: workspaceId,
    metadata: { language },
  });
  return workspace;
}

export async function listMembers(workspaceId: string) {
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships;
}

export async function inviteMember(params: { workspaceId: string; email: string; role: Role; invitedById: string }) {
  const existingUser = await prisma.user.findUnique({ where: { email: params.email } });

  const membership = await prisma.membership.create({
    data: {
      workspaceId: params.workspaceId,
      role: params.role,
      invitedEmail: params.email,
      invitedAt: new Date(),
      acceptedAt: existingUser ? new Date() : null,
      userId: existingUser?.id ?? (await ensurePlaceholderUser(params.email)).id,
    },
  });

  await logAudit({
    workspaceId: params.workspaceId,
    userId: params.invitedById,
    action: "member.invited",
    entityType: "Membership",
    entityId: membership.id,
    metadata: { email: params.email, role: params.role },
  });

  return membership;
}

async function ensurePlaceholderUser(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email } });
}

export async function updateMemberRole(membershipId: string, role: Role) {
  return prisma.membership.update({ where: { id: membershipId }, data: { role } });
}

export async function removeMember(membershipId: string) {
  return prisma.membership.delete({ where: { id: membershipId } });
}
