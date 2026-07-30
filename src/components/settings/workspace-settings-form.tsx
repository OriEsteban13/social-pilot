"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUTOMATION_LEVELS, AUTOMATION_LEVEL_LABELS } from "@/lib/enums";
import type { AutomationLevel } from "@/lib/enums";
import { updateWorkspaceSettingsAction } from "@/app/(app)/w/[workspaceId]/settings/actions";
import { setAutomationLevelAction } from "@/app/(app)/w/[workspaceId]/actions";

export interface WorkspaceSettingsData {
  name: string;
  website: string;
  industry: string;
  country: string;
  languages: string;
  automationLevel: AutomationLevel;
}

export function WorkspaceSettingsForm({ workspaceId, initial }: { workspaceId: string; initial: WorkspaceSettingsData }) {
  const [form, setForm] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof WorkspaceSettingsData>(key: K, value: WorkspaceSettingsData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      await updateWorkspaceSettingsAction(workspaceId, {
        name: form.name,
        website: form.website,
        industry: form.industry,
        country: form.country,
        languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
      });
      toast.success("Configuración guardada");
      router.refresh();
    });
  }

  function changeAutomationLevel(level: AutomationLevel) {
    startTransition(async () => {
      await setAutomationLevelAction(workspaceId, level);
      set("automationLevel", level);
      toast.success(`Modo actualizado a ${AUTOMATION_LEVEL_LABELS[level]}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Web</Label>
              <Input id="website" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Sector</Label>
              <Input id="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages">Idiomas</Label>
              <Input id="languages" value={form.languages} onChange={(e) => set("languages", e.target.value)} />
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

      <Card>
        <CardHeader>
          <CardTitle>Nivel de automatización</CardTitle>
          <CardDescription>Controla cuánto puede hacer la IA sin tu intervención.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {AUTOMATION_LEVELS.map((level) => (
            <label
              key={level}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                form.automationLevel === level ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                checked={form.automationLevel === level}
                onChange={() => changeAutomationLevel(level)}
                disabled={isPending}
              />
              <span className="text-sm font-medium">{AUTOMATION_LEVEL_LABELS[level]}</span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
