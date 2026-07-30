import { listMediaAssets } from "@/server/services/library";
import { LibraryGrid } from "@/components/library/library-grid";

export default async function LibraryPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const assets = await listMediaAssets(workspaceId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="text-sm text-muted-foreground">Imágenes generadas, plantillas y archivos reutilizables de esta empresa.</p>
      </div>
      <LibraryGrid workspaceId={workspaceId} assets={assets} />
    </div>
  );
}
