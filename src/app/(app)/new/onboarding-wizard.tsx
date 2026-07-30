"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_LEVELS,
  AUTOMATION_LEVEL_LABELS,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  TONES,
  TONE_LABELS,
} from "@/lib/enums";
import type { AutomationLevel, SocialPlatform, Tone } from "@/lib/enums";
import { completeOnboarding, type OnboardingInput } from "./actions";
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

const GOALS = [
  "Notoriedad",
  "Captación de leads",
  "Generación de tráfico",
  "Posicionamiento experto",
  "Lanzamiento de producto",
  "Employer branding",
  "Engagement",
  "Conversión",
  "Comunicación corporativa",
];

const STEP_TITLES = [
  "Tu empresa",
  "Redes sociales",
  "Marca",
  "Objetivos",
  "Frecuencia y modo",
  "Revisar y generar",
];

type FormState = {
  name: string;
  website: string;
  industry: string;
  country: string;
  languages: string;
  platforms: SocialPlatform[];
  tone: Tone;
  brandColors: string[];
  differentiators: string;
  claims: string;
  goals: string[];
  automationLevel: AutomationLevel;
};

const initialState: FormState = {
  name: "",
  website: "",
  industry: "",
  country: "España",
  languages: "es",
  platforms: [],
  tone: "CERCANO",
  brandColors: ["#6366f1", "#0ea5e9"],
  differentiators: "",
  claims: "",
  goals: [],
  automationLevel: "ASSISTED",
};

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const canContinue = step !== 0 || form.name.trim().length > 1;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function submit() {
    setError(undefined);
    const payload: OnboardingInput = {
      name: form.name,
      website: form.website,
      industry: form.industry,
      country: form.country,
      languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
      platforms: form.platforms,
      tone: form.tone,
      brandColors: form.brandColors.filter(Boolean),
      differentiators: form.differentiators.split(",").map((d) => d.trim()).filter(Boolean),
      claims: form.claims.split(",").map((c) => c.trim()).filter(Boolean),
      goals: form.goals,
      automationLevel: form.automationLevel,
    };

    startTransition(async () => {
      const result = await completeOnboarding(payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="mb-1 flex items-center gap-1.5">
          {STEP_TITLES.map((_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <CardTitle>
          Paso {step + 1} de {STEP_TITLES.length}: {STEP_TITLES[step]}
        </CardTitle>
        <CardDescription>
          {step === 0 && "Cuéntanos lo básico de la empresa que vamos a gestionar."}
          {step === 1 && "Selecciona las redes que quieres que gestione la IA (podrás conectarlas de verdad más adelante)."}
          {step === 2 && "Define un tono y unos colores de partida — podrás ampliar el Brand Brain después."}
          {step === 3 && "¿Qué quieres conseguir con las redes sociales?"}
          {step === 4 && "Elige cuánto control quieres ceder a la IA."}
          {step === 5 && "Revisamos todo y generamos la primera estrategia con IA."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la empresa</Label>
              <Input id="name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Camaleonic Survey" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Página web</Label>
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Sector</Label>
                <Input id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="SaaS, deporte, retail…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="languages">Idiomas (separados por coma)</Label>
                <Input id="languages" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="es, en" />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <label
                key={platform}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  form.platforms.includes(platform) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={form.platforms.includes(platform)}
                  onCheckedChange={() => setForm({ ...form, platforms: toggle(form.platforms, platform) })}
                />
                <span className="text-sm font-medium">{SOCIAL_PLATFORM_LABELS[platform]}</span>
              </label>
            ))}
            <p className="col-span-full text-xs text-muted-foreground">
              Sin credenciales oficiales, la conexión queda en modo simulado — el resto del producto funciona igual (ver
              Redes conectadas dentro de la empresa).
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tono de comunicación</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setForm({ ...form, tone })}
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
              <Label>Colores de marca</Label>
              <div className="flex gap-3">
                {form.brandColors.map((color, i) => (
                  <input
                    key={i}
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const next = [...form.brandColors];
                      next[i] = e.target.value;
                      setForm({ ...form, brandColors: next });
                    }}
                    className="h-10 w-14 cursor-pointer rounded border"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="differentiators">Diferenciadores (separados por coma)</Label>
              <Textarea id="differentiators" value={form.differentiators} onChange={(e) => setForm({ ...form, differentiators: e.target.value })} placeholder="Soporte cercano, implantación en 48h…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claims">Claims (separados por coma)</Label>
              <Textarea id="claims" value={form.claims} onChange={(e) => setForm({ ...form, claims: e.target.value })} placeholder="La forma más rápida de escuchar a tus clientes" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-wrap gap-2">
            {GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setForm({ ...form, goals: toggle(form.goals, goal) })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  form.goals.includes(goal) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {goal}
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2">
            {AUTOMATION_LEVELS.map((level) => (
              <label
                key={level}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  form.automationLevel === level ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="automationLevel"
                  className="mt-1"
                  checked={form.automationLevel === level}
                  onChange={() => setForm({ ...form, automationLevel: level })}
                />
                <span>
                  <span className="block text-sm font-medium">{AUTOMATION_LEVEL_LABELS[level]}</span>
                  <span className="block text-xs text-muted-foreground">{levelDescription(level)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm">
            <SummaryRow label="Empresa" value={form.name || "—"} />
            <SummaryRow label="Redes" value={form.platforms.map((p) => SOCIAL_PLATFORM_LABELS[p]).join(", ") || "Ninguna seleccionada"} />
            <SummaryRow label="Tono" value={TONE_LABELS[form.tone]} />
            <SummaryRow label="Objetivos" value={form.goals.join(", ") || "Sin definir"} />
            <SummaryRow label="Modo" value={AUTOMATION_LEVEL_LABELS[form.automationLevel]} />
            {error ? <p className="text-destructive">{error}</p> : null}
          </div>
        )}
      </CardContent>
      <div className="flex items-center justify-between border-t p-4">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isPending}>
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isPending ? "Generando estrategia…" : "Generar estrategia con IA"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function levelDescription(level: AutomationLevel): string {
  switch (level) {
    case "MANUAL":
      return "Tú creas, editas y publicas cada contenido.";
    case "ASSISTED":
      return "La IA prepara el contenido y tú lo apruebas antes de publicar.";
    case "PILOT":
      return "La IA genera y programa; pides una aprobación en bloque cuando quieras.";
    case "AUTOPILOT":
      return "La IA genera, programa y publica sola, dentro de las reglas aprobadas.";
    case "AUTOPILOT_APPROVAL":
      return "Como Autopilot, pero pide una única aprobación semanal o mensual.";
  }
}
