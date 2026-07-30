import { notFound } from "next/navigation";
import { getBlogArticle } from "@/server/services/blog";
import { BlogArticleEditor } from "@/components/blog/blog-article-editor";

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ workspaceId: string; blogArticleId: string }>;
}) {
  const { workspaceId, blogArticleId } = await params;
  const article = await getBlogArticle(blogArticleId);
  if (!article || article.workspaceId !== workspaceId) notFound();

  return <BlogArticleEditor workspaceId={workspaceId} article={article} />;
}
