"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, Languages, Loader2, Newspaper, Sparkles, ThumbsDown, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { CONTENT_FORMAT_LABELS } from "@/lib/enums";
import type { ContentFormat, SocialPlatform } from "@/lib/enums";
import { languageLabel } from "@/lib/languages";
import { saveIdeaAction, rejectIdeaAction, convertIdeaAction } from "@/app/(app)/w/[workspaceId]/ideas/actions";

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-600 border-red-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  LOW: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export interface IdeaCardData {
  id: string;
  title: string;
  description: string;
  rationale: string | null;
  cta: string | null;
  priority: string;
  status: string;
  recommendedPlatform: string | null;
  recommendedFormat: string | null;
  recommendedDate: Date | string | null;
  pillar: { name: string; color: string | null } | null;
  contentKind: string;
  language: string | null;
}

export function IdeaCard({ workspaceId, idea }: { workspaceId: string; idea: IdeaCardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function act(action: (workspaceId: string, ideaId: string) => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      await action(workspaceId, idea.id);
      if (successMsg) toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {idea.contentKind === "BLOG_ARTICLE" ? (
              <Badge variant="outline" className="gap-1">
                <Newspaper className="h-3 w-3" /> Blog
              </Badge>
            ) : idea.recommendedPlatform ? (
              <PlatformBadge platform={idea.recommendedPlatform as SocialPlatform} />
            ) : null}
            {idea.pillar ? <Badge variant="outline">{idea.pillar.name}</Badge> : null}
            {idea.language ? (
              <Badge variant="outline" className="gap-1">
                <Languages className="h-3 w-3" /> {languageLabel(idea.language)}
              </Badge>
            ) : null}
          </div>
          <Badge variant="outline" className={PRIORITY_STYLE[idea.priority]}>
            {idea.priority}
          </Badge>
        </div>
        <h3 className="text-sm font-semibold leading-snug">{idea.title}</h3>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-muted-foreground">{idea.description}</p>
        {idea.rationale ? (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Por qué puede funcionar: </span>
            {idea.rationale}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {idea.recommendedFormat ? <Badge variant="secondary">{CONTENT_FORMAT_LABELS[idea.recommendedFormat as ContentFormat]}</Badge> : null}
          {idea.cta ? <span>CTA: {idea.cta}</span> : null}
        </div>

        {idea.status === "NEW" || idea.status === "SAVED" ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => act(convertIdeaAction, "")} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {idea.contentKind === "BLOG_ARTICLE" ? "Convertir en artículo" : "Convertir en publicación"}
            </Button>
            {idea.status === "NEW" && (
              <Button size="sm" variant="outline" onClick={() => act(saveIdeaAction, "Idea guardada")} disabled={isPending}>
                <Bookmark className="h-3.5 w-3.5" />
                Guardar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => act(rejectIdeaAction, "Idea rechazada")} disabled={isPending}>
              <ThumbsDown className="h-3.5 w-3.5" />
              Rechazar
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="mt-auto w-fit gap-1">
            <Sparkles className="h-3 w-3" />
            {idea.status === "CONVERTED" ? "Convertida" : "Rechazada"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
