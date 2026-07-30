import Link from "next/link";
import { listContentItems } from "@/server/services/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { formatDateTime } from "@/lib/format";
import { CONTENT_STATUS_LABELS } from "@/lib/enums";
import type { ContentStatus, SocialPlatform } from "@/lib/enums";
import { FileStack } from "lucide-react";

export default async function PostsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const items = await listContentItems(workspaceId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Publicaciones</h1>
        <p className="text-sm text-muted-foreground">Todo el contenido creado en esta empresa, en cualquier estado.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <FileStack className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no hay publicaciones.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Redes</TableHead>
                <TableHead>Pilar</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Programado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer">
                  <TableCell className="max-w-xs">
                    <Link href={`/w/${workspaceId}/create/${item.id}`} className="line-clamp-1 hover:underline">
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.variants.map((v) => (
                        <PlatformBadge key={v.id} platform={v.platform as SocialPlatform} className="h-5 w-5 text-[9px]" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{item.pillar?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{CONTENT_STATUS_LABELS[item.status as ContentStatus]}</Badge>
                  </TableCell>
                  <TableCell>{item.contentScore ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.calendarEntry ? formatDateTime(item.calendarEntry.scheduledAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
