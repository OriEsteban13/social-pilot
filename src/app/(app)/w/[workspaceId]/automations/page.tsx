import { listAutomations } from "@/server/services/automations";
import { AutomationsBoard } from "@/components/automations/automations-board";

export default async function AutomationsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const automations = await listAutomations(workspaceId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automatizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Reglas que la IA sigue sin intervención manual. El botón &ldquo;Generar semana&rdquo; del Dashboard usa la
          frecuencia configurada para cada red — aquí puedes añadir reglas adicionales.
        </p>
      </div>
      <AutomationsBoard workspaceId={workspaceId} automations={automations} />
    </div>
  );
}
