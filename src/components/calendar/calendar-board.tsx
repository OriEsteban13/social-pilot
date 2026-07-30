"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { cn } from "@/lib/utils";
import { dateKey, isSameMonth, isToday, monthGridDays, addMonths, WEEKDAY_LABELS, MONTH_LABEL_FMT } from "@/lib/calendar-grid";
import { formatTime, formatWeekday } from "@/lib/format";
import { CONTENT_STATUS_LABELS } from "@/lib/enums";
import type { ContentStatus, SocialPlatform } from "@/lib/enums";
import type { listCalendarEntries } from "@/server/services/calendar";
import { rescheduleEntryAction, applyBalanceSuggestionAction } from "@/app/(app)/w/[workspaceId]/actions";
import { EntryPanel } from "./entry-panel";

export type CalendarEntry = Awaited<ReturnType<typeof listCalendarEntries>>[number];

const STATUS_DOT: Record<string, string> = {
  IDEA: "bg-slate-400",
  DRAFT: "bg-slate-400",
  GENERATING: "bg-sky-400",
  PENDING_REVIEW: "bg-amber-400",
  CHANGES_REQUESTED: "bg-orange-500",
  APPROVED: "bg-emerald-400",
  SCHEDULED: "bg-emerald-500",
  PUBLISHING: "bg-sky-500",
  PUBLISHED: "bg-emerald-600",
  ERROR: "bg-red-500",
  CANCELLED: "bg-slate-300",
};

export function CalendarBoard({
  workspaceId,
  monthAnchor,
  entries,
}: {
  workspaceId: string;
  monthAnchor: string;
  entries: CalendarEntry[];
}) {
  const router = useRouter();
  const anchor = new Date(monthAnchor);
  const [view, setView] = useState<"month" | "list">("month");
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const key = dateKey(new Date(entry.scheduledAt));
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  const grid = monthGridDays(anchor);
  const activeEntry = entries.find((e) => e.id === activeId) ?? null;

  function monthHref(offset: number) {
    const next = addMonths(anchor, offset);
    const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    return `/w/${workspaceId}/calendar?month=${value}`;
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const entry = entries.find((e) => e.id === active.id);
    if (!entry) return;
    const targetKey = String(over.id);
    if (targetKey === dateKey(new Date(entry.scheduledAt))) return;

    const [y, m, d] = targetKey.split("-").map(Number);
    const original = new Date(entry.scheduledAt);
    const newDate = new Date(y, m - 1, d, original.getHours(), original.getMinutes());

    const suggestion = await rescheduleEntryAction(workspaceId, entry.id, newDate.toISOString());
    router.refresh();

    if (suggestion) {
      toast.message("Sugerencia de equilibrio editorial", {
        description: suggestion.message,
        duration: 10000,
        action: {
          label: "Aceptar",
          onClick: () => {
            applyBalanceSuggestionAction(workspaceId, suggestion.conflictEntryId, suggestion.suggestedDate).then(() =>
              router.refresh()
            );
          },
        },
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={monthHref(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize">{MONTH_LABEL_FMT.format(anchor)}</h2>
          <Button variant="outline" size="icon" asChild>
            <Link href={monthHref(1)}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button variant={view === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setView("month")}>
            <LayoutGrid className="h-4 w-4" /> Mes
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
            <ListIcon className="h-4 w-4" /> Lista
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
            {grid.map((day) => (
              <DayCell
                key={dateKey(day)}
                day={day}
                inMonth={isSameMonth(day, anchor)}
                entries={entriesByDay.get(dateKey(day)) ?? []}
                onSelect={setSelected}
              />
            ))}
          </div>
          <DragOverlay>{activeEntry ? <EntryChip entry={activeEntry} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <ListView entries={[...entries].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))} onSelect={setSelected} />
      )}

      <EntryPanel workspaceId={workspaceId} entry={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  entries,
  onSelect,
}: {
  day: Date;
  inMonth: boolean;
  entries: CalendarEntry[];
  onSelect: (entry: CalendarEntry) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey(day) });
  const visible = entries.slice(0, 3);
  const overflow = entries.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-1 border-b border-r p-1.5",
        !inMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-primary/5"
      )}
    >
      <span className={cn("text-xs", isToday(day) && "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground")}>
        {day.getDate()}
      </span>
      <div className="flex flex-col gap-1">
        {visible.map((entry) => (
          <DraggableEntry key={entry.id} entry={entry} onSelect={onSelect} />
        ))}
        {overflow > 0 && <span className="px-1 text-[11px] text-muted-foreground">+{overflow} más</span>}
      </div>
    </div>
  );
}

function DraggableEntry({ entry, onSelect }: { entry: CalendarEntry; onSelect: (entry: CalendarEntry) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.id });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(entry)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("w-full text-left", isDragging && "opacity-30")}
    >
      <EntryChip entry={entry} />
    </button>
  );
}

function EntryChip({ entry, dragging }: { entry: CalendarEntry; dragging?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1 text-[11px] shadow-sm",
        dragging && "shadow-lg"
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[entry.status] ?? "bg-slate-400")} />
      <PlatformBadge platform={entry.contentVariant.platform as SocialPlatform} className="h-4 w-4 text-[9px]" />
      <span className="truncate">{entry.contentItem.title}</span>
    </span>
  );
}

function ListView({ entries, onSelect }: { entries: CalendarEntry[]; onSelect: (entry: CalendarEntry) => void }) {
  if (entries.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">No hay publicaciones programadas este mes.</p>;
  }
  return (
    <div className="flex-1 divide-y overflow-y-auto">
      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
        >
          <PlatformBadge platform={entry.contentVariant.platform as SocialPlatform} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.contentItem.title}</p>
            <p className="truncate text-xs text-muted-foreground">{entry.contentVariant.body.slice(0, 90)}</p>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {formatWeekday(entry.scheduledAt)} · {formatTime(entry.scheduledAt)}
          </span>
          <span className="rounded-full border px-2 py-0.5 text-[11px]">{CONTENT_STATUS_LABELS[entry.status as ContentStatus]}</span>
        </button>
      ))}
    </div>
  );
}
