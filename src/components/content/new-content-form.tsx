"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { createFromBriefAction } from "@/app/(app)/w/[workspaceId]/create/actions";

export function NewContentForm({ workspaceId }: { workspaceId: string }) {
  const [brief, setBrief] = useState("");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["LINKEDIN", "INSTAGRAM"]);
  const [language, setLanguage] = useState("en");
  const [isPending, startTransition] = useTransition();

  function toggle(p: SocialPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function submit() {
    if (!brief.trim() || platforms.length === 0) {
      toast.error("Escribe una idea y elige al menos una red.");
      return;
    }
    startTransition(() => createFromBriefAction(workspaceId, brief, platforms, language));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo contenido</CardTitle>
        <CardDescription>
          Parte de una idea, una URL, una noticia o una descripción breve. La IA generará una versión para cada red
          seleccionada usando el Brand Brain de esta empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Ej: Anuncio del nuevo panel de analítica en tiempo real…"
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          {SOCIAL_PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <Checkbox checked={platforms.includes(p)} onCheckedChange={() => toggle(p)} />
              {SOCIAL_PLATFORM_LABELS[p]}
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="content-language">Idioma</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="content-language" className="w-44">
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
        <Button onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {isPending ? "Generando…" : "Generar contenido"}
        </Button>
      </CardContent>
    </Card>
  );
}
