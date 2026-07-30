"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEDIA_TYPES } from "@/lib/enums";
import type { MediaType } from "@/lib/enums";
import { addMediaAssetAction, deleteMediaAssetAction } from "@/app/(app)/w/[workspaceId]/library/actions";

export interface MediaAssetData {
  id: string;
  type: string;
  url: string;
  folder: string | null;
  sourceGenerator: string | null;
  createdAt: Date | string;
}

export function LibraryGrid({ workspaceId, assets }: { workspaceId: string; assets: MediaAssetData[] }) {
  const [filter, setFilter] = useState<MediaType | "ALL">("ALL");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<MediaType>("IMAGE");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = filter === "ALL" ? assets : assets.filter((a) => a.type === filter);

  function add() {
    if (!url.trim()) return;
    startTransition(async () => {
      await addMediaAssetAction(workspaceId, type, url);
      setUrl("");
      toast.success("Añadido a la biblioteca");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteMediaAssetAction(workspaceId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filter === "ALL" ? "secondary" : "ghost"} onClick={() => setFilter("ALL")}>
          Todo
        </Button>
        {MEDIA_TYPES.map((t) => (
          <Button key={t} size="sm" variant={filter === t ? "secondary" : "ghost"} onClick={() => setFilter(t)}>
            {t}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as MediaType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="URL del archivo" value={url} onChange={(e) => setUrl(e.target.value)} className="w-56" />
          <Button onClick={add} disabled={isPending || !url.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No hay elementos en esta categoría.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((asset) => (
            <div key={asset.id} className="group relative overflow-hidden rounded-lg border">
              {asset.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
              ) : asset.type === "VIDEO" ? (
                <video src={asset.url} controls muted className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  {asset.type}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/90 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Badge variant="outline" className="text-[10px]">
                  {asset.sourceGenerator ? "IA" : "Manual"}
                </Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(asset.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
