import { listSocialAccounts } from "@/server/services/accounts";
import { AccountsBoard } from "@/components/accounts/accounts-board";

export default async function AccountsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const accounts = await listSocialAccounts(workspaceId);
  const usingMetricool = process.env.SOCIAL_PROVIDER === "metricool";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Redes conectadas</h1>
        <p className="text-sm text-muted-foreground">
          {usingMetricool
            ? "La publicación se hace a través de Metricool. Conecta cada red directamente en app.metricool.com (con el Brand ID configurado en Configuración) y pulsa \"Conectar\" aquí para sincronizar el estado."
            : "Conecta las cuentas oficiales de cada red. Mientras no haya credenciales reales configuradas, la conexión queda en modo simulado, pero el resto del producto (calendario, aprobación, publicación) funciona igual."}
        </p>
      </div>
      <AccountsBoard workspaceId={workspaceId} accounts={accounts} usingMetricool={usingMetricool} />
    </div>
  );
}
