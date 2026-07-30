"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { createBlankBlogArticle, generateBlogArticleDraft, updateBlogArticle, setBlogArticleStatus } from "@/server/services/blog";

export async function createBlogArticleAction(workspaceId: string, title: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  const article = await createBlankBlogArticle(workspaceId, title, user.id);
  revalidatePath(`/w/${workspaceId}/blog`);
  redirect(`/w/${workspaceId}/blog/${article.id}`);
}

export async function generateBlogArticleAction(workspaceId: string, blogArticleId: string, brief: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await generateBlogArticleDraft(blogArticleId, brief);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
}

export async function updateBlogArticleAction(
  workspaceId: string,
  blogArticleId: string,
  data: { title?: string; body?: string; metaDescription?: string; cta?: string }
) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await updateBlogArticle(blogArticleId, data);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
}

export async function sendBlogArticleToReviewAction(workspaceId: string, blogArticleId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await setBlogArticleStatus(blogArticleId, "PENDING_REVIEW", user.id);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
  revalidatePath(`/w/${workspaceId}/blog`);
}

export async function approveBlogArticleAction(workspaceId: string, blogArticleId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await setBlogArticleStatus(blogArticleId, "APPROVED", user.id);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
  revalidatePath(`/w/${workspaceId}/blog`);
}

export async function requestBlogArticleChangesAction(workspaceId: string, blogArticleId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "REVIEWER"]);
  await setBlogArticleStatus(blogArticleId, "CHANGES_REQUESTED", user.id);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
  revalidatePath(`/w/${workspaceId}/blog`);
}

export async function markBlogArticlePublishedAction(workspaceId: string, blogArticleId: string) {
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "EDITOR"]);
  await setBlogArticleStatus(blogArticleId, "PUBLISHED", user.id);
  revalidatePath(`/w/${workspaceId}/blog/${blogArticleId}`);
  revalidatePath(`/w/${workspaceId}/blog`);
}
