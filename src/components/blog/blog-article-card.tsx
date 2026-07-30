import Link from "next/link";
import { AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BLOG_ARTICLE_STATUS_LABELS } from "@/lib/enums";
import type { BlogArticleStatus } from "@/lib/enums";

export interface BlogArticleCardData {
  id: string;
  title: string;
  metaDescription: string | null;
  status: string;
  wordCount: number | null;
  needsValidation: boolean;
  pillar: { name: string; color: string | null } | null;
}

export function BlogArticleCard({ workspaceId, article }: { workspaceId: string; article: BlogArticleCardData }) {
  return (
    <Link href={`/w/${workspaceId}/blog/${article.id}`}>
      <Card className="flex h-full flex-col transition-colors hover:border-primary/40">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" /> {BLOG_ARTICLE_STATUS_LABELS[article.status as BlogArticleStatus]}
            </Badge>
            {article.pillar ? <Badge variant="secondary">{article.pillar.name}</Badge> : null}
          </div>
          <CardTitle className="text-sm leading-snug">{article.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2">
          <p className="line-clamp-3 text-sm text-muted-foreground">{article.metaDescription ?? "Sin generar todavía."}</p>
          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>{article.wordCount ? `${article.wordCount} palabras` : "—"}</span>
            {article.needsValidation ? (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Revisar
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
