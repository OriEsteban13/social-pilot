"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { CONTENT_STATUS_LABELS, SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { ContentStatus, SocialPlatform } from "@/lib/enums";
import type { CalendarEntry } from "./calendar-board";
import {
  updateVariantBodyAction,
  rescheduleEntryAction,
  quickApproveAction,
  cancelCalendarEntryAction,
} from "@/app/(app)/w/[workspaceId]/actions";

function toDatetimeLocal(date: Date | string) {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EntryPanel({
  workspaceId,
  entry,
  onOpenChange,
}: {
  workspaceId: string;
  entry: CalendarEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(entry)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {/* key={entry.id} monta una instancia nueva por publicación, así el
            estado local (texto/fecha en edición) parte siempre del valor
            correcto sin necesitar un efecto que lo sincronice desde props. */}
        {entry ? <EntryPanelBody key={entry.id} workspaceId={workspaceId} entry={entry} onOpenChange={onOpenChange} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function EntryPanelBody({
  workspaceId,
  entry,
  onOpenChange,
}: {
  workspaceId: string;
  entry: CalendarEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState(entry.contentVariant.body);
  const [when, setWhen] = useState(toDatetimeLocal(entry.scheduledAt));
  const [isPending, startTransition] = useTransition();

  const platform = entry.contentVariant.platform as SocialPlatform;
  const media = entry.contentVariant.mediaAssets?.[0];
  const canApprove = entry.status === "PENDING_REVIEW" || entry.status === "DRAFT" || entry.status === "CHANGES_REQUESTED";
  const canCancel = !["PUBLISHED", "PUBLISHING", "CANCELLED"].includes(entry.status);

  function saveBody() {
    startTransition(async () => {
      await updateVariantBodyAction(workspaceId, entry.contentVariant.id, body);
      toast.success("Texto actualizado");
      router.refresh();
    });
  }

  function saveDate() {
    startTransition(async () => {
      await rescheduleEntryAction(workspaceId, entry.id, new Date(when).toISOString());
      toast.success("Fecha actualizada");
      router.refresh();
    });
  }

  function approve() {
    startTransition(async () => {
      await quickApproveAction(workspaceId, entry.contentItemId);
      toast.success("Publicación aprobada y programada");
      router.refresh();
      onOpenChange(false);
    });
  }

  function cancel() {
    startTransition(async () => {
      await cancelCalendarEntryAction(workspaceId, entry.id, entry.contentItemId);
      toast.success("Publicación cancelada");
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <PlatformBadge platform={platform} />
          <SheetTitle className="text-base">{SOCIAL_PLATFORM_LABELS[platform]}</SheetTitle>
          <Badge variant="outline" className="ml-auto">
            {CONTENT_STATUS_LABELS[entry.status as ContentStatus]}
          </Badge>
        </div>
        <SheetDescription className="text-left">{entry.contentItem.title}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-4 pb-4">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt={media.thumbnailUrl ?? "Imagen del contenido"} className="w-full rounded-lg border object-cover" />
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="entry-body">Texto</Label>
          <Textarea id="entry-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={saveBody} disabled={isPending || body === entry.contentVariant.body}>
              Guardar texto
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="entry-date">Fecha y hora</Label>
          <div className="flex gap-2">
            <Input id="entry-date" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <Button size="sm" variant="outline" onClick={saveDate} disabled={isPending}>
              Guardar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>CTA</Label>
          <p className="text-sm text-muted-foreground">{entry.contentVariant.cta || "—"}</p>
        </div>

        <div className="flex justify-end">
          <Link
            href={`/w/${workspaceId}/create/${entry.contentItemId}`}
            className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
          >
            Editar completo en el Content Engine <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <SheetFooter className="flex-row justify-between border-t">
        {canCancel ? (
          <Button variant="ghost" onClick={cancel} disabled={isPending}>
            <Trash2 className="h-4 w-4" /> Cancelar
          </Button>
        ) : (
          <span />
        )}
        {canApprove ? (
          <Button onClick={approve} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprobar y programar
          </Button>
        ) : null}
      </SheetFooter>
    </>
  );
}
