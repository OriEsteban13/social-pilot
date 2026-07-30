"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addWebsiteSourceAction, reanalyzeWebsiteSourceAction } from "@/app/(app)/w/[workspaceId]/brand-brain/actions";
import { formatDateTime } from "@/lib/format";

export interface WebsiteSourceData {
  id: string;
  url: string;
  status: string;
  extractedSummary: string | null;
  lastCrawledAt: Date | string | null;
}

export function WebsiteSources({ workspaceId, sources }: { workspaceId: string; sources: WebsiteSourceData[] }) {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    if (!url.trim()) return;
    startTransition(async () => {
      await addWebsiteSourceAction(workspaceId, url);
      setUrl("");
      toast.success("Web analizada");
      router.refresh();
    });
  }

  function reanalyze(id: string) {
    startTransition(async () => {
      await reanalyzeWebsiteSourceAction(workspaceId, id);
      toast.success("Análisis actualizado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4" /> Web de la empresa
        </CardTitle>
        <CardDescription>La IA analiza automáticamente las páginas públicas para proponer pilares y mensajes clave.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="https://tuweb.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={add} disabled={isPending || !url.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analizar"}
          </Button>
        </div>
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={source.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <a href={source.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium underline underline-offset-4">
                  {source.url}
                </a>
                <div className="flex items-center gap-2">
                  <Badge variant={source.status === "CRAWLED" ? "secondary" : "outline"}>{source.status}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => reanalyze(source.id)} disabled={isPending}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {source.extractedSummary && <p className="mt-1 text-xs text-muted-foreground">{source.extractedSummary}</p>}
              {source.lastCrawledAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">Última lectura: {formatDateTime(source.lastCrawledAt)}</p>
              )}
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-muted-foreground">No has añadido ninguna web todavía.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
