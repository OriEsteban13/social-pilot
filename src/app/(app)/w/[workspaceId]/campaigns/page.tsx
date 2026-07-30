import { listCampaigns } from "@/server/services/campaigns";
import { CampaignsBoard } from "@/components/campaigns/campaigns-board";

export default async function CampaignsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const campaigns = await listCampaigns(workspaceId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campañas</h1>
        <p className="text-sm text-muted-foreground">Agrupa publicaciones alrededor de un objetivo o lanzamiento.</p>
      </div>
      <CampaignsBoard workspaceId={workspaceId} campaigns={campaigns} />
    </div>
  );
}
