"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Rocket, Send, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BLOG_ARTICLE_STATUS_LABELS } from "@/lib/enums";
import type { BlogArticleStatus } from "@/lib/enums";
import { toStringArray } from "@/lib/json";
import type { getBlogArticle } from "@/server/services/blog";
import {
  generateBlogArticleAction,
  updateBlogArticleAction,
  sendBlogArticleToReviewAction,
  approveBlogArticleAction,
  requestBlogArticleChangesAction,
  markBlogArticlePublishedAction,
} from "@/app/(app)/w/[workspaceId]/blog/actions";

type ArticleData = NonNullable<Awaited<ReturnType<typeof getBlogArticle>>>;

export function BlogArticleEditor({ workspaceId, article }: { workspaceId: string; article: ArticleData }) {
  const router = useRouter();
  const [brief, setBrief] = useState(article.title);
  const [title, setTitle] = useState(article.title);
  const [metaDescription, setMetaDescription] = useState(article.metaDescription ?? "");
  const [body, setBody] = useState(article.body);
  const [cta, setCta] = useState(article.cta ?? "");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const tags = toStringArray(article.tags as never);
  const status = article.status as BlogArticleStatus;
  const dirty = title !== article.title || metaDescription !== (article.metaDescription ?? "") || body !== article.body || cta !== (article.cta ?? "");

  function run(key: string, fn: () => Promise<unknown>, successMsg?: string) {
    setPendingAction(key);
    startTransition(async () => {
      await fn();
      if (successMsg) toast.success(successMsg);
      router.refresh();
      setPendingAction(null);
    });
  }

  function generate() {
    run("generate", () => generateBlogArticleAction(workspaceId, article.id, brief), "Artículo generado");
  }

  function save() {
    run("save", () => updateBlogArticleAction(workspaceId, article.id, { title, metaDescription, body, cta }), "Cambios guardados");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary">{BLOG_ARTICLE_STATUS_LABELS[status]}</Badge>
            {article.pillar ? <Badge variant="outline">{article.pillar.name}</Badge> : null}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{article.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && article.body ? (
            <Button variant="outline" onClick={() => run("toReview", () => sendBlogArticleToReviewAction(workspaceId, article.id), "Enviado a revisión")} disabled={isPending}>
              {pendingAction === "toReview" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a revisión
            </Button>
          ) : null}
          {status === "CHANGES_REQUESTED" ? (
            <Button variant="outline" onClick={() => run("toReview", () => sendBlogArticleToReviewAction(workspaceId, article.id), "Enviado a revisión")} disabled={isPending}>
              {pendingAction === "toReview" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Reenviar a revisión
            </Button>
          ) : null}
          {status === "PENDING_REVIEW" ? (
            <>
              <Button
                variant="outline"
                onClick={() => run("changes", () => requestBlogArticleChangesAction(workspaceId, article.id), "Cambios solicitados")}
                disabled={isPending}
              >
                {pendingAction === "changes" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Solicitar cambios
              </Button>
              <Button onClick={() => run("approve", () => approveBlogArticleAction(workspaceId, article.id), "Artículo aprobado")} disabled={isPending}>
                {pendingAction === "approve" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprobar
              </Button>
            </>
          ) : null}
          {status === "APPROVED" ? (
            <Button onClick={() => run("publish", () => markBlogArticlePublishedAction(workspaceId, article.id), "Marcado como publicado")} disabled={isPending}>
              {pendingAction === "publish" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Marcar como publicado
            </Button>
          ) : null}
        </div>
      </div>

      {status === "PUBLISHED" && article.publishedAt ? (
        <p className="text-sm text-muted-foreground">
          Publicado el {new Date(article.publishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}. No hay
          integración con ningún CMS todavía — este estado es manual, cópialo a la web cuando lo publiques de verdad.
        </p>
      ) : null}

      {article.needsValidation && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Este artículo necesita revisión manual: puede que falte contexto en el Brand Brain o que la IA en modo plantilla no domine del todo el idioma. Revísalo con atención antes de aprobarlo.</p>
        </div>
      )}

      {!article.body ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generar borrador con IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="brief">Tema / briefing del artículo</Label>
              <Textarea id="brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} />
            </div>
            <Button onClick={generate} disabled={isPending || !brief.trim()}>
              {pendingAction === "generate" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar artículo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="article-title">Título</Label>
            <Input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="article-meta">Meta descripción (SEO)</Label>
              <span className={metaDescription.length > 155 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {metaDescription.length}/155
              </span>
            </div>
            <Textarea id="article-meta" rows={2} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="article-body">Cuerpo del artículo</Label>
              <span className="text-xs text-muted-foreground">{body.split(/\s+/).filter(Boolean).length} palabras</span>
            </div>
            <Textarea id="article-body" rows={22} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-cta">Llamada a la acción</Label>
            <Input id="article-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => run("regenerate", () => generateBlogArticleAction(workspaceId, article.id, brief), "Artículo regenerado")}
              disabled={isPending}
            >
              {pendingAction === "regenerate" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerar con IA
            </Button>
            <Button onClick={save} disabled={isPending || !dirty}>
              {pendingAction === "save" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
