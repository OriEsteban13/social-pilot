"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_KINDS, CONTENT_KIND_LABELS } from "@/lib/enums";
import type { ContentKind } from "@/lib/enums";
import { SUPPORTED_LANGUAGES, languageLabel } from "@/lib/languages";
import { generateIdeasAction } from "@/app/(app)/w/[workspaceId]/ideas/actions";

export function GenerateIdeasButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(6);
  const [contentKind, setContentKind] = useState<ContentKind>("SOCIAL_POST");
  const [language, setLanguage] = useState("en");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    startTransition(async () => {
      await generateIdeasAction(workspaceId, count, contentKind, language);
      toast.success(`${count} ideas de ${CONTENT_KIND_LABELS[contentKind].toLowerCase()} generadas en ${languageLabel(language)}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="h-4 w-4" />
          Generar ideas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar ideas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea-kind">Tipo de contenido</Label>
            <Select value={contentKind} onValueChange={(v) => setContentKind(v as ContentKind)}>
              <SelectTrigger id="idea-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {CONTENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="idea-count">Cantidad de ideas</Label>
            <Input
              id="idea-count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="idea-language">Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="idea-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={generate} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isPending ? "Generando…" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
