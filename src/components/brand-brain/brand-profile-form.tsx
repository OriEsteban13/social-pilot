"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONES, TONE_LABELS } from "@/lib/enums";
import type { Tone } from "@/lib/enums";
import { updateBrandProfileAction } from "@/app/(app)/w/[workspaceId]/brand-brain/actions";

export interface BrandProfileData {
  description: string;
  valueProposition: string;
  tone: Tone;
  targetAudiences: string;
  differentiators: string;
  claims: string;
  allowedTerms: string;
  forbiddenTerms: string;
  brandColors: string[];
  competitors: string;
}

export function BrandProfileForm({ workspaceId, initial }: { workspaceId: string; initial: BrandProfileData }) {
  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof BrandProfileData>(key: K, value: BrandProfileData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      await updateBrandProfileAction(workspaceId, {
        description: form.description,
        valueProposition: form.valueProposition,
        tone: form.tone,
        targetAudiences: splitList(form.targetAudiences),
        differentiators: splitList(form.differentiators),
        claims: splitList(form.claims),
        allowedTerms: splitList(form.allowedTerms),
        forbiddenTerms: splitList(form.forbiddenTerms),
        brandColors: form.brandColors,
        competitors: splitList(form.competitors),
      });
      toast.success("Brand Brain actualizado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de marca</CardTitle>
        <CardDescription>
          La IA usa esta información literal para redactar. Si un campo está vacío, marcará el contenido como
          pendiente de validar en lugar de inventar datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="description">Descripción de la empresa</Label>
          <Textarea id="description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valueProposition">Propuesta de valor</Label>
          <Textarea id="valueProposition" rows={2} value={form.valueProposition} onChange={(e) => set("valueProposition", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Tono de comunicación</Label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => set("tone", tone)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  form.tone === tone ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {TONE_LABELS[tone]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAudiences">Audiencias objetivo (separadas por coma)</Label>
          <Input id="targetAudiences" value={form.targetAudiences} onChange={(e) => set("targetAudiences", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="differentiators">Diferenciadores (separados por coma)</Label>
          <Input id="differentiators" value={form.differentiators} onChange={(e) => set("differentiators", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claims">Claims (separados por coma)</Label>
          <Input id="claims" value={form.claims} onChange={(e) => set("claims", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="competitors">Competidores (separados por coma)</Label>
          <Input id="competitors" value={form.competitors} onChange={(e) => set("competitors", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="allowedTerms">Palabras que deben usarse</Label>
            <Input id="allowedTerms" value={form.allowedTerms} onChange={(e) => set("allowedTerms", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="forbiddenTerms">Palabras prohibidas</Label>
            <Input id="forbiddenTerms" value={form.forbiddenTerms} onChange={(e) => set("forbiddenTerms", e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Colores de marca</Label>
          <div className="flex items-center gap-2">
            {form.brandColors.map((color, i) => (
              <input
                key={i}
                type="color"
                value={color}
                onChange={(e) => {
                  const next = [...form.brandColors];
                  next[i] = e.target.value;
                  set("brandColors", next);
                }}
                className="h-9 w-12 cursor-pointer rounded border"
              />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set("brandColors", [...form.brandColors, "#888888"])}>
              + color
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
