import { getPerformanceSummary, getAIPerformanceInsight } from "@/server/services/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformChart } from "@/components/analytics/platform-chart";
import { SyncButton } from "@/components/analytics/sync-button";
import { formatNumber } from "@/lib/format";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";

export default async function AnalyticsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const [summary, insight] = await Promise.all([
    getPerformanceSummary(workspaceId, 30),
    getAIPerformanceInsight(workspaceId),
  ]);

  const chartData = Object.entries(summary.byPlatform).map(([platform, values]) => ({
    platform: SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] ?? platform,
    impressions: values.impressions,
    engagement: values.engagement,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analítica</h1>
          <p className="text-sm text-muted-foreground">Últimos 30 días de actividad publicada.</p>
        </div>
        <SyncButton workspaceId={workspaceId} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Publicaciones" value={summary.totals.posts} />
        <Stat label="Impresiones" value={summary.totals.impressions} />
        <Stat label="Alcance" value={summary.totals.reach} />
        <Stat label="Nuevos seguidores" value={summary.totals.newFollowers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rendimiento por red</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay métricas. Publica contenido y sincroniza.</p>
          ) : (
            <PlatformChart data={chartData} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contenidos con mejor rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            ) : (
              <ul className="space-y-3">
                {summary.topPosts.map((post) => (
                  <li key={post.id} className="text-sm">
                    <p className="line-clamp-2 text-foreground">{post.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOCIAL_PLATFORM_LABELS[post.platform as SocialPlatform]} · {formatNumber(post.impressions)} impresiones · {formatNumber(post.engagement)} interacciones
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qué dice la IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{insight.summary}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <InsightItem label="Mejor horario" value={insight.bestTimeToPost} />
              <InsightItem label="Mejor tono" value={insight.bestTone} />
              <InsightItem label="Mejor formato" value={insight.bestFormat} />
              <InsightItem label="Mejor CTA" value={insight.bestCta} />
            </dl>
            <ul className="space-y-1 border-t pt-2 text-muted-foreground">
              {insight.recommendations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function InsightItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
