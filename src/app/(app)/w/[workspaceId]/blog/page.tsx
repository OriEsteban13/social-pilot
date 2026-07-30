import { listBlogArticles } from "@/server/services/blog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlogArticleCard } from "@/components/blog/blog-article-card";
import { NewBlogArticleButton } from "@/components/blog/new-blog-article-button";
import { BLOG_ARTICLE_STATUSES, BLOG_ARTICLE_STATUS_LABELS } from "@/lib/enums";
import type { BlogArticleStatus } from "@/lib/enums";
import { Newspaper } from "lucide-react";

export default async function BlogPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const articles = await listBlogArticles(workspaceId);

  const groups = Object.fromEntries(
    BLOG_ARTICLE_STATUSES.map((status) => [status, articles.filter((a) => a.status === status)])
  ) as Record<BlogArticleStatus, typeof articles>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Artículos para la web de la empresa. Genera el borrador con IA, revísalo y apruébalo antes de publicarlo.
          </p>
        </div>
        <NewBlogArticleButton workspaceId={workspaceId} />
      </div>

      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Newspaper className="mb-4 h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg font-medium">Todavía no hay artículos</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Crea uno directamente aquí, o genera ideas de tipo &quot;Artículo de blog&quot; desde la página de Ideas.
          </p>
          <NewBlogArticleButton workspaceId={workspaceId} />
        </div>
      ) : (
        <Tabs defaultValue="PENDING_REVIEW">
          <TabsList className="flex-wrap">
            {BLOG_ARTICLE_STATUSES.map((status) => (
              <TabsTrigger key={status} value={status}>
                {BLOG_ARTICLE_STATUS_LABELS[status]} ({groups[status].length})
              </TabsTrigger>
            ))}
          </TabsList>
          {BLOG_ARTICLE_STATUSES.map((status) => (
            <TabsContent key={status} value={status} className="mt-4">
              {groups[status].length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups[status].map((article) => (
                    <BlogArticleCard key={article.id} workspaceId={workspaceId} article={article} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
