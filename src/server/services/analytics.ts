import { prisma } from "@/server/db/client";
import { getSocialAdapter } from "@/server/integrations/registry";
import { getAIProvider } from "@/server/ai/registry";
import type { SocialPlatform } from "@/lib/enums";

/**
 * Sincroniza métricas simuladas/reales para las publicaciones publicadas en
 * los últimos N días. En el adaptador simulado, genera una lectura de
 * métricas con variabilidad aleatoria para poblar la analítica de demo.
 */
export async function syncAnalytics(workspaceId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const publishedPosts = await prisma.publishedPost.findMany({
    where: {
      publishedAt: { gte: since },
      scheduledPost: { calendarEntry: { workspaceId } },
    },
    include: { scheduledPost: { include: { socialAccount: true } } },
  });

  let synced = 0;
  for (const post of publishedPosts) {
    const platform = post.scheduledPost.socialAccount.platform as SocialPlatform;
    const adapter = getSocialAdapter(platform);
    const readings = await adapter.fetchAnalytics({ externalId: post.externalId ?? post.id, since });

    for (const reading of readings) {
      await prisma.socialMetric.upsert({
        where: { publishedPostId_capturedAt: { publishedPostId: post.id, capturedAt: reading.capturedAt } },
        create: { publishedPostId: post.id, ...reading },
        update: { ...reading },
      });
    }
    synced++;
  }

  return { syncedPosts: synced };
}

export interface WorkspacePerformanceSummary {
  totals: {
    posts: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    newFollowers: number;
  };
  byPlatform: Record<string, { posts: number; impressions: number; engagement: number }>;
  topPosts: { id: string; body: string; platform: string; impressions: number; engagement: number; url?: string | null }[];
}

export async function getPerformanceSummary(workspaceId: string, days = 30): Promise<WorkspacePerformanceSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const publishedPosts = await prisma.publishedPost.findMany({
    where: { publishedAt: { gte: since }, scheduledPost: { calendarEntry: { workspaceId } } },
    include: {
      metrics: true,
      scheduledPost: {
        include: {
          socialAccount: true,
          calendarEntry: { include: { contentVariant: true } },
        },
      },
    },
  });

  const totals = { posts: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, newFollowers: 0 };
  const byPlatform: WorkspacePerformanceSummary["byPlatform"] = {};
  const topPosts: WorkspacePerformanceSummary["topPosts"] = [];

  for (const post of publishedPosts) {
    const platform = post.scheduledPost.socialAccount.platform;
    const latestMetric = post.metrics.at(-1);
    if (!latestMetric) continue;

    totals.posts++;
    totals.impressions += latestMetric.impressions ?? 0;
    totals.reach += latestMetric.reach ?? 0;
    totals.likes += latestMetric.likes ?? 0;
    totals.comments += latestMetric.comments ?? 0;
    totals.shares += latestMetric.shares ?? 0;
    totals.clicks += latestMetric.clicks ?? 0;
    totals.newFollowers += latestMetric.newFollowers ?? 0;

    const engagement = (latestMetric.likes ?? 0) + (latestMetric.comments ?? 0) + (latestMetric.shares ?? 0);

    byPlatform[platform] ??= { posts: 0, impressions: 0, engagement: 0 };
    byPlatform[platform].posts++;
    byPlatform[platform].impressions += latestMetric.impressions ?? 0;
    byPlatform[platform].engagement += engagement;

    topPosts.push({
      id: post.id,
      body: post.scheduledPost.calendarEntry.contentVariant.body,
      platform,
      impressions: latestMetric.impressions ?? 0,
      engagement,
      url: post.externalUrl,
    });
  }

  topPosts.sort((a, b) => b.engagement - a.engagement);

  return { totals, byPlatform, topPosts: topPosts.slice(0, 5) };
}

export async function getAIPerformanceInsight(workspaceId: string) {
  const summary = await getPerformanceSummary(workspaceId);
  const provider = getAIProvider();
  return provider.summarizePerformance(summary as unknown as Record<string, unknown>);
}
