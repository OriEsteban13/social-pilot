"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { connectSocialAccount, disconnectSocialAccount } from "@/server/services/accounts";
import type { SocialPlatform } from "@/lib/enums";

export async function connectAccountAction(workspaceId: string, platform: SocialPlatform) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await connectSocialAccount(workspaceId, platform, user.id);
  revalidatePath(`/w/${workspaceId}/accounts`);
}

export async function disconnectAccountAction(workspaceId: string, accountId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN"]);
  await disconnectSocialAccount(accountId, user.id);
  revalidatePath(`/w/${workspaceId}/accounts`);
}
