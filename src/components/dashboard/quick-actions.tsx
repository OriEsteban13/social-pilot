"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenSquare, Sparkles, Rocket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateWeekAction, setAutomationLevelAction } from "@/app/(app)/w/[workspaceId]/actions";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";

export function QuickActions({ workspaceId, isAutopilot }: { workspaceId: string; isAutopilot: boolean }) {
  const router = useRouter();
  const [isGenerating, startGenerate] = useTransition();
  const [isEnabling, startEnable] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleGenerateWeek() {
    startGenerate(async () => {
      const result = await generateWeekAction(workspaceId);
      const byPlatform = Object.entries(result.byPlatform)
        .map(([platform, count]) => `${count} ${SOCIAL_PLATFORM_LABELS[platform as SocialPlatform]}`)
        .join(", ");
      toast.success(`Semana generada: ${result.totalCreated} publicaciones`, {
        description: result.autoApproved
          ? `${byPlatform}. Publicadas automáticamente (Autopilot).`
          : `${byPlatform}. Revísalas en el calendario y aprueba en bloque.`,
      });
      router.refresh();
    });
  }

  function handleEnableAutopilot() {
    startEnable(async () => {
      await setAutomationLevelAction(workspaceId, "AUTOPILOT");
      toast.success("Autopilot activado", { description: "La IA generará, programará y publicará siguiendo tus reglas." });
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <Link href={`/w/${workspaceId}/create`}>
          <PenSquare className="h-4 w-4" />
          Crear contenido
        </Link>
      </Button>
      <Button onClick={handleGenerateWeek} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isGenerating ? "Generando semana…" : "Generar semana"}
      </Button>
      {!isAutopilot && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Rocket className="h-4 w-4" />
              Activar piloto automático
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Activar Autopilot?</DialogTitle>
              <DialogDescription>
                A partir de ahora la IA generará, programará y publicará contenido sin pedir aprobación previa,
                respetando el Content Score mínimo y las reglas activas. Podrás desactivarlo en cualquier momento
                desde Configuración.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEnableAutopilot} disabled={isEnabling}>
                {isEnabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Sí, activar Autopilot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
