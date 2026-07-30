"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";
import { formatRelativeTime } from "@/lib/format";
import { createAutomationAction, toggleAutomationAction, deleteAutomationAction } from "@/app/(app)/w/[workspaceId]/automations/actions";

export interface AutomationData {
  id: string;
  name: string;
  trigger: string;
  frequency: string | null;
  requiresApproval: boolean;
  status: string;
  runs: { id: string; status: string; startedAt: Date | string; resultSummary: string | null }[];
}

const TRIGGER_LABELS: Record<string, string> = {
  WEEKLY_GENERATE: "Generar contenido cada semana",
  MONTHLY_GENERATE: "Generar contenido cada mes",
  ON_APPROVAL_PUBLISH: "Publicar automáticamente lo aprobado",
  WEBSITE_NEW_ARTICLE: "Nuevo artículo publicado en la web",
  PERFORMANCE_DIGEST: "Resumen de rendimiento periódico",
  CUSTOM: "Regla personalizada",
};

export function AutomationsBoard({ workspaceId, automations }: { workspaceId: string; automations: AutomationData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("WEEKLY_GENERATE");
  const [frequency, setFrequency] = useState("Cada lunes");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["LINKEDIN"]);
  const [requiresApproval, setRequiresApproval] = useState(true);

  function toggle(id: string, current: string) {
    startTransition(async () => {
      await toggleAutomationAction(workspaceId, id, current === "ACTIVE" ? "PAUSED" : "ACTIVE");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteAutomationAction(workspaceId, id);
      router.refresh();
    });
  }

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createAutomationAction(workspaceId, { name, trigger, frequency, platforms, requiresApproval });
      setOpen(false);
      setName("");
      toast.success("Automatización creada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nueva automatización
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva automatización</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Publicar 3 veces por semana en LinkedIn" />
              </div>
              <div className="space-y-2">
                <Label>Disparador</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                >
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Cada lunes" />
              </div>
              <div className="space-y-2">
                <Label>Redes</Label>
                <div className="flex flex-wrap gap-3">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={platforms.includes(p)}
                        onCheckedChange={() => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                      />
                      {SOCIAL_PLATFORM_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(Boolean(v))} />
                Requiere aprobación antes de publicar
              </label>
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={isPending || !name.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Zap className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no hay automatizaciones configuradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{automation.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[automation.trigger] ?? automation.trigger} · {automation.frequency ?? "sin frecuencia definida"}
                  </p>
                </div>
                <Switch checked={automation.status === "ACTIVE"} onCheckedChange={() => toggle(automation.id, automation.status)} disabled={isPending} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={automation.requiresApproval ? "outline" : "secondary"}>
                    {automation.requiresApproval ? "Con aprobación" : "Publica directamente"}
                  </Badge>
                  <Badge variant={automation.status === "ACTIVE" ? "secondary" : "outline"}>{automation.status}</Badge>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Últimas ejecuciones</p>
                  {automation.runs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin historial todavía.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {automation.runs.map((run) => (
                        <li key={run.id} className="flex justify-between">
                          <span>{run.resultSummary ?? run.status}</span>
                          <span>{formatRelativeTime(run.startedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => remove(automation.id)} disabled={isPending}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
