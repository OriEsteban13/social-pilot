import Link from "next/link";
import { listContentItems } from "@/server/services/content";
import { NewContentForm } from "@/components/content/new-content-form";
import { ImportIdeasDialog } from "@/components/content/import-ideas-dialog";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { Badge } from "@/components/ui/badge";
import { CONTENT_STATUS_LABELS } from "@/lib/enums";
import type { ContentStatus, SocialPlatform } from "@/lib/enums";

export default async function CreateContentPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const items = (await listContentItems(workspaceId)).slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crear contenido</h1>
          <p className="text-sm text-muted-foreground">Genera una pieza y adáptala a cada plataforma en segundos.</p>
        </div>
        <ImportIdeasDialog workspaceId={workspaceId} />
      </div>

      <NewContentForm workspaceId={workspaceId} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Contenidos recientes</h2>
        <div className="divide-y rounded-lg border">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Todavía no has creado ningún contenido.</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/w/${workspaceId}/create/${item.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                <div className="flex -space-x-1">
                  {item.variants.slice(0, 3).map((v) => (
                    <PlatformBadge key={v.id} platform={v.platform as SocialPlatform} className="ring-2 ring-background" />
                  ))}
                </div>
                <span className="flex-1 truncate text-sm">{item.title}</span>
                {item.contentScore ? <Badge variant="outline">Score {item.contentScore}</Badge> : null}
                <Badge variant="secondary">{CONTENT_STATUS_LABELS[item.status as ContentStatus]}</Badge>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
