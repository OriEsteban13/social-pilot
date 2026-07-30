import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Lightbulb, TrendingUp } from "lucide-react";
import { getWorkspaceDashboard } from "@/server/services/dashboard";
import { getAIPerformanceInsight } from "@/server/services/analytics";
import { getWorkspace } from "@/server/services/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { LanguageSelector } from "@/components/dashboard/language-selector";
import { formatNumber, formatTime } from "@/lib/format";
import { CONTENT_STATUS_LABELS } from "@/lib/enums";
import type { SocialPlatform, ContentStatus } from "@/lib/enums";

export default async function WorkspaceDashboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const [dashboard, insight, workspace] = await Promise.all([
    getWorkspaceDashboard(workspaceId),
    getAIPerformanceInsight(workspaceId),
    getWorkspace(workspaceId),
  ]);

  const { status, todaysEntries, pendingApprovalCount, newIdeasCount, nextEntry, errorEntries, performance } = dashboard;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hoy</h1>
          <p className="text-sm text-muted-foreground">Un resumen de toda la actividad de esta empresa, en una sola pantalla.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSelector workspaceId={workspaceId} currentLanguage={workspace?.defaultLanguage ?? "es"} />
          <QuickActions workspaceId={workspaceId} isAutopilot={status.tone === "autopilot"} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Publicaciones de hoy</CardTitle>
            <Badge variant="secondary">{todaysEntries.length}</Badge>
          </CardHeader>
          <CardContent>
            {todaysEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay nada programado para hoy.</p>
            ) : (
              <ul className="divide-y">
                {todaysEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5">
                    <PlatformBadge platform={entry.contentVariant.platform as SocialPlatform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{entry.contentItem.title}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(entry.scheduledAt)}</p>
                    </div>
                    <Badge variant="outline">{CONTENT_STATUS_LABELS[entry.status as ContentStatus]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryLine icon={CheckCircle2} label="Automatización" value={status.label} />
            <SummaryLine icon={AlertTriangle} label="Pendiente de aprobación" value={String(pendingApprovalCount)} link={pendingApprovalCount > 0 ? `/w/${workspaceId}/calendar` : undefined} />
            <SummaryLine icon={Lightbulb} label="Ideas nuevas" value={String(newIdeasCount)} link={`/w/${workspaceId}/ideas`} />
            <SummaryLine
              icon={CalendarClock}
              label="Próxima publicación"
              value={nextEntry ? `${nextEntry.contentItem.title.slice(0, 28)}…` : "Sin programar"}
              link={nextEntry ? `/w/${workspaceId}/calendar` : undefined}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Rendimiento (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Publicaciones" value={performance.totals.posts} />
            <Stat label="Impresiones" value={performance.totals.impressions} />
            <Stat label="Alcance" value={performance.totals.reach} />
            <Stat label="Interacciones" value={performance.totals.likes + performance.totals.comments + performance.totals.shares} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recomendaciones de IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">{insight.summary}</p>
            <ul className="space-y-1.5 text-sm">
              {insight.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span> {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {errorEntries.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> Errores de publicación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {errorEntries.map((item) => (
                <li key={item.id}>
                  <Link href={`/w/${workspaceId}/create/${item.id}`} className="underline underline-offset-4">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryLine({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  link?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
  return link ? (
    <Link href={link} className="block rounded-md hover:bg-muted/50">
      {content}
    </Link>
  ) : (
    content
  );
}
