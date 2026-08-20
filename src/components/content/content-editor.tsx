"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Languages,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Smile,
  SmilePlus,
  SpellCheck,
  CalendarPlus,
  Sparkles,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { VariantPreview } from "./variant-preview";
import { ContentScorePanel } from "./content-score-panel";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  CONTENT_STATUS_LABELS,
  PILLAR_COLORS,
} from "@/lib/enums";
import type { ContentStatus, SocialPlatform } from "@/lib/enums";
import { PLATFORM_CHAR_LIMITS } from "@/lib/platform-limits";
import { toStringArray } from "@/lib/json";
import type { ContentScoreResult, AdjustInstruction } from "@/server/ai/types";
import type { getContentItem } from "@/server/services/content";
import {
  generateVariantAction,
  adjustVariantAction,
  generateImageForVariantAction,
  generateVideoForVariantAction,
  sendToApprovalAction,
  approveContentDirectAction,
  scheduleContentAction,
} from "@/app/(app)/w/[workspaceId]/create/actions";
import { updateVariantBodyAction } from "@/app/(app)/w/[workspaceId]/actions";

type ContentItemData = NonNullable<Awaited<ReturnType<typeof getContentItem>>>;
type VariantData = ContentItemData["variants"][number];

const DEFAULT_FORMAT: Record<SocialPlatform, string> = {
  LINKEDIN: "POST",
  INSTAGRAM: "POST",
  TIKTOK: "VIDEO",
  THREADS: "POST",
  X: "POST",
};

const ADJUST_BUTTONS: { instruction: AdjustInstruction; label: string; icon: typeof Minus }[] = [
  { instruction: "SHORTEN", label: "Acortar", icon: Minus },
  { instruction: "LENGTHEN", label: "Alargar", icon: Plus },
  { instruction: "MORE_COMMERCIAL", label: "Más comercial", icon: Sparkles },
  { instruction: "MORE_EDUCATIONAL", label: "Más educativo", icon: Sparkles },
  { instruction: "ADD_EMOJIS", label: "Añadir emojis", icon: SmilePlus },
  { instruction: "REMOVE_EMOJIS", label: "Quitar emojis", icon: Smile },
  { instruction: "PROOFREAD", label: "Revisar gramática", icon: SpellCheck },
  { instruction: "ADD_CTA", label: "Añadir CTA", icon: Plus },
];

export function ContentEditor({
  workspaceId,
  item,
  scores,
}: {
  workspaceId: string;
  item: ContentItemData;
  scores: Record<string, ContentScoreResult>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SocialPlatform>((item.variants[0]?.platform as SocialPlatform) ?? "LINKEDIN");
  const [bodyByVariant, setBodyByVariant] = useState<Record<string, string>>(
    Object.fromEntries(item.variants.map((v) => [v.id, v.body]))
  );
  const [scheduleValue, setScheduleValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // Idioma para la próxima generación por plataforma — por defecto, el
  // idioma real de la idea de origen (si esta pieza viene de una), para que
  // "Generar para X" no cambie de idioma por sorpresa; se puede cambiar
  // explícitamente para pedir una traducción.
  const [language, setLanguage] = useState(item.idea?.language ?? "en");

  const activeVariant = item.variants.find((v) => v.platform === tab);

  function run(key: string, fn: () => Promise<unknown>, successMsg?: string) {
    setPendingAction(key);
    startTransition(async () => {
      await fn();
      if (successMsg) toast.success(successMsg);
      router.refresh();
      setPendingAction(null);
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary">{CONTENT_STATUS_LABELS[item.status as ContentStatus]}</Badge>
            {item.pillar ? (
              <Badge variant="outline" style={{ borderColor: item.pillar.color ?? PILLAR_COLORS[0] }}>
                {item.pillar.name}
              </Badge>
            ) : null}
            {item.contentScore ? <Badge variant="outline">Score global {item.contentScore}</Badge> : null}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{item.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run("approval", () => sendToApprovalAction(workspaceId, item.id), "Enviado a aprobación")} disabled={isPending}>
            {pendingAction === "approval" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar a aprobación
          </Button>
          <Button onClick={() => run("approve", () => approveContentDirectAction(workspaceId, item.id), "Contenido aprobado")} disabled={isPending}>
            {pendingAction === "approve" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprobar directamente
          </Button>
          {activeVariant ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <CalendarPlus className="h-4 w-4" />
                  Programar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Programar {SOCIAL_PLATFORM_LABELS[tab]}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="schedule-at">Fecha y hora</Label>
                  <Input id="schedule-at" type="datetime-local" value={scheduleValue} onChange={(e) => setScheduleValue(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button
                    disabled={!scheduleValue || isPending}
                    onClick={() =>
                      run(
                        "schedule",
                        () => scheduleContentAction(workspaceId, item.id, activeVariant.id, new Date(scheduleValue).toISOString()),
                        "Publicación programada"
                      )
                    }
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SocialPlatform)}>
        <TabsList>
          {SOCIAL_PLATFORMS.map((platform) => {
            const variant = item.variants.find((v) => v.platform === platform);
            return (
              <TabsTrigger key={platform} value={platform} className="gap-1.5">
                <PlatformBadge platform={platform} className="h-4 w-4 text-[9px]" />
                {SOCIAL_PLATFORM_LABELS[platform]}
                {!variant && <span className="text-muted-foreground">·</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {!activeVariant ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16">
          <p className="text-sm text-muted-foreground">Todavía no hay versión para {SOCIAL_PLATFORM_LABELS[tab]}.</p>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40" aria-label="Idioma de la publicación">
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
            <Button
              onClick={() =>
                run(
                  `gen-${tab}`,
                  () => generateVariantAction(workspaceId, item.id, tab, DEFAULT_FORMAT[tab] as never, item.title, language),
                  `Versión de ${SOCIAL_PLATFORM_LABELS[tab]} generada`
                )
              }
              disabled={isPending}
            >
              {pendingAction === `gen-${tab}` && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar para {SOCIAL_PLATFORM_LABELS[tab]}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {activeVariant.needsValidation && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-2 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Este texto necesita revisión manual: puede que falte contexto en el Brand Brain, o que se haya generado
                en un idioma que la IA en modo plantilla no domina del todo. Revísalo antes de aprobarlo o programarlo.
              </p>
            </div>
          )}
          <div className="space-y-4">
            <VariantEditor
              workspaceId={workspaceId}
              contentItemId={item.id}
              variant={activeVariant}
              body={bodyByVariant[activeVariant.id] ?? activeVariant.body}
              onBodyChange={(v) => setBodyByVariant((prev) => ({ ...prev, [activeVariant.id]: v }))}
            />

            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Medios</p>
              {activeVariant.mediaAssets[0] ? (
                activeVariant.mediaAssets[0].type === "VIDEO" ? (
                  <video src={activeVariant.mediaAssets[0].url} controls className="mb-2 w-40 rounded-md border" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeVariant.mediaAssets[0].url} alt="Imagen generada" className="mb-2 w-40 rounded-md border" />
                )
              ) : (
                <p className="mb-2 text-xs text-muted-foreground">Sin imagen ni vídeo todavía.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(
                      "image",
                      () => generateImageForVariantAction(workspaceId, item.id, activeVariant.id, item.title),
                      activeVariant.mediaAssets[0]?.type === "IMAGE" ? "Imagen regenerada" : "Imagen generada"
                    )
                  }
                  disabled={isPending}
                >
                  {pendingAction === "image" && isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activeVariant.mediaAssets[0]?.type === "IMAGE" ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  {activeVariant.mediaAssets[0]?.type === "IMAGE" ? "Regenerar imagen" : "Generar imagen con IA"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run("video", async () => {
                      const result = await generateVideoForVariantAction(workspaceId, item.id, activeVariant.id, item.title);
                      if (result.status === "SCRIPT_READY") {
                        toast.info("Guion generado (sin vídeo real)", {
                          description: "Activa VIDEO_PROVIDER=fal + FAL_KEY para renderizar el vídeo. Guion: " + result.script.slice(0, 140) + "…",
                        });
                      } else {
                        toast.success("Vídeo generado");
                      }
                    })
                  }
                  disabled={isPending}
                >
                  {pendingAction === "video" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <VideoIcon className="h-4 w-4" />}
                  Generar vídeo con IA
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <VariantPreview
              platform={tab}
              workspaceName="Tu empresa"
              body={bodyByVariant[activeVariant.id] ?? activeVariant.body}
              hashtags={toStringArray(activeVariant.hashtags)}
              mediaUrl={activeVariant.mediaAssets[0]?.url}
              mediaType={activeVariant.mediaAssets[0]?.type}
            />
            {scores[activeVariant.id] ? <ContentScorePanel result={scores[activeVariant.id]} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function VariantEditor({
  workspaceId,
  contentItemId,
  variant,
  body,
  onBodyChange,
}: {
  workspaceId: string;
  contentItemId: string;
  variant: VariantData;
  body: string;
  onBodyChange: (value: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [translateTo, setTranslateTo] = useState(variant.language === "en" ? "es" : "en");
  const limit = PLATFORM_CHAR_LIMITS[variant.platform as SocialPlatform];

  function adjust(instruction: AdjustInstruction, targetLanguage?: string) {
    setBusy(instruction);
    startTransition(async () => {
      await adjustVariantAction(workspaceId, contentItemId, variant.id, instruction, targetLanguage);
      router.refresh();
      setBusy(null);
    });
  }

  function save() {
    setBusy("save");
    startTransition(async () => {
      await updateVariantBodyAction(workspaceId, variant.id, body);
      toast.success("Texto guardado");
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="variant-body">Texto</Label>
        <span className={body.length > limit ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {body.length}/{limit}
        </span>
      </div>
      <Textarea id="variant-body" rows={10} value={body} onChange={(e) => onBodyChange(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {ADJUST_BUTTONS.map(({ instruction, label, icon: Icon }) => (
          <Button key={instruction} size="sm" variant="outline" onClick={() => adjust(instruction)} disabled={isPending}>
            {busy === instruction && isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => adjust("PROOFREAD")} disabled={isPending}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerar
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={translateTo} onValueChange={setTranslateTo}>
          <SelectTrigger className="h-8 w-32" aria-label="Idioma destino">
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
        <Button size="sm" variant="outline" onClick={() => adjust("TRANSLATE", translateTo)} disabled={isPending}>
          {busy === "TRANSLATE" && isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          Traducir
        </Button>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={isPending || body === variant.body}>
          {busy === "save" && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
