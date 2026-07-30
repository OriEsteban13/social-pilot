import { listIdeas } from "@/server/services/ideas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdeaCard } from "@/components/ideas/idea-card";
import { GenerateIdeasButton } from "@/components/ideas/generate-ideas-button";
import { Lightbulb } from "lucide-react";

export default async function IdeasPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ideas = await listIdeas(workspaceId);

  const groups = {
    NEW: ideas.filter((i) => i.status === "NEW"),
    SAVED: ideas.filter((i) => i.status === "SAVED"),
    CONVERTED: ideas.filter((i) => i.status === "CONVERTED"),
    REJECTED: ideas.filter((i) => i.status === "REJECTED"),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
          <p className="text-sm text-muted-foreground">
            Generadas a partir de tu Brand Brain, pilares de contenido y rendimiento histórico.
          </p>
        </div>
        <GenerateIdeasButton workspaceId={workspaceId} />
      </div>

      {ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Lightbulb className="mb-4 h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg font-medium">Todavía no hay ideas</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Genera tu primer lote de ideas basadas en el Brand Brain de esta empresa.
          </p>
          <GenerateIdeasButton workspaceId={workspaceId} />
        </div>
      ) : (
        <Tabs defaultValue="NEW">
          <TabsList>
            <TabsTrigger value="NEW">Nuevas ({groups.NEW.length})</TabsTrigger>
            <TabsTrigger value="SAVED">Guardadas ({groups.SAVED.length})</TabsTrigger>
            <TabsTrigger value="CONVERTED">Convertidas ({groups.CONVERTED.length})</TabsTrigger>
            <TabsTrigger value="REJECTED">Rechazadas ({groups.REJECTED.length})</TabsTrigger>
          </TabsList>
          {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              {groups[key].length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups[key].map((idea) => (
                    <IdeaCard key={idea.id} workspaceId={workspaceId} idea={idea} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
