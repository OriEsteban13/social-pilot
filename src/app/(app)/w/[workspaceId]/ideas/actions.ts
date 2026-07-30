"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { generateIdeas, saveIdea, rejectIdea, convertIdeaToContent } from "@/server/services/ideas";
import type { ContentKind } from "@/lib/enums";

export async function generateIdeasAction(workspaceId: string, count = 6, contentKind: ContentKind = "SOCIAL_POST", language?: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await generateIdeas({ workspaceId, count, sourceHint: "manual", contentKind, language });
  revalidatePath(`/w/${workspaceId}/ideas`);
}

export async function saveIdeaAction(workspaceId: string, ideaId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await saveIdea(ideaId);
  revalidatePath(`/w/${workspaceId}/ideas`);
}

export async function rejectIdeaAction(workspaceId: string, ideaId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await rejectIdea(ideaId);
  revalidatePath(`/w/${workspaceId}/ideas`);
}

export async function convertIdeaAction(workspaceId: string, ideaId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const created = await convertIdeaToContent(ideaId, user.id);
  revalidatePath(`/w/${workspaceId}/ideas`);
  redirect(created.contentKind === "BLOG_ARTICLE" ? `/w/${workspaceId}/blog/${created.id}` : `/w/${workspaceId}/create/${created.id}`);
}
