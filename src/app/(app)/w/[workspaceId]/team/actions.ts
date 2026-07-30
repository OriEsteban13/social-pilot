"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { inviteMember, updateMemberRole, removeMember } from "@/server/services/workspace";
import type { Role } from "@/lib/enums";

export async function inviteMemberAction(workspaceId: string, email: string, role: Role) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await inviteMember({ workspaceId, email, role, invitedById: user.id });
  revalidatePath(`/w/${workspaceId}/team`);
}

export async function updateMemberRoleAction(workspaceId: string, membershipId: string, role: Role) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await updateMemberRole(membershipId, role);
  revalidatePath(`/w/${workspaceId}/team`);
}

export async function removeMemberAction(workspaceId: string, membershipId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await removeMember(membershipId);
  revalidatePath(`/w/${workspaceId}/team`);
}
