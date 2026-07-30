import { randomUUID } from "crypto";
import type { SocialPlatform } from "@/lib/enums";
import type {
  ConnectAccountInput,
  ConnectionStatus,
  CreatePostInput,
  DraftPostRef,
  FetchAnalyticsInput,
  MediaRef,
  PlatformMetrics,
  PostStatus,
  PublishPostInput,
  PublishedPostRef,
  SchedulePostInput,
  ScheduledPostRef,
  SocialAccountRef,
  SocialAdapter,
  TokenRefreshResult,
  UploadMediaInput,
} from "./types";

const PLATFORM_URL_PREFIX: Record<SocialPlatform, string> = {
  LINKEDIN: "https://www.linkedin.com/feed/update/sim",
  INSTAGRAM: "https://www.instagram.com/p/sim",
  TIKTOK: "https://www.tiktok.com/@demo/video/sim",
  THREADS: "https://www.threads.net/@demo/post/sim",
  X: "https://x.com/demo/status/sim",
};

/**
 * Adaptador simulado, común a las 5 redes sociales. Implementa la interfaz
 * `SocialAdapter` completa devolviendo respuestas con la misma forma que una
 * API real (ids, urls, estado), pero sin realizar ninguna llamada externa.
 * Se usa mientras `<PLATFORM>_ENABLED=false` (por defecto) — ver
 * INTEGRATIONS.md. Toda la lógica de calendario, aprobación, reintentos e
 * idempotencia del producto se ejerce igualmente contra este adaptador.
 */
export class SimulatedAdapter implements SocialAdapter {
  readonly simulated = true;

  constructor(readonly platform: SocialPlatform) {}

  async connectAccount(input: ConnectAccountInput): Promise<SocialAccountRef> {
    return {
      externalAccountId: `sim_acct_${randomUUID().slice(0, 8)}`,
      handle: `demo.${this.platform.toLowerCase()}`,
      displayName: `Cuenta demo de ${this.platform} (workspace ${input.workspaceId})`,
      accessToken: `sim_token_${randomUUID()}`,
      refreshToken: `sim_refresh_${randomUUID()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      scopes: ["simulated:read", "simulated:write"],
    };
  }

  async refreshToken(): Promise<TokenRefreshResult> {
    return {
      accessToken: `sim_token_${randomUUID()}`,
      refreshToken: `sim_refresh_${randomUUID()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
    };
  }

  async validateConnection(): Promise<ConnectionStatus> {
    return { connected: true, status: "CONNECTED", message: "Conexión simulada activa." };
  }

  async createPost(input: CreatePostInput): Promise<DraftPostRef> {
    void input;
    return { draftId: `sim_draft_${randomUUID().slice(0, 10)}` };
  }

  async uploadMedia(input: UploadMediaInput): Promise<MediaRef> {
    return { mediaId: `sim_media_${randomUUID().slice(0, 10)}`, url: input.url };
  }

  async schedulePost(input: SchedulePostInput): Promise<ScheduledPostRef> {
    void input;
    return { externalId: `sim_sched_${randomUUID().slice(0, 10)}`, status: "SCHEDULED" };
  }

  async publishPost(input: PublishPostInput): Promise<PublishedPostRef> {
    const externalId = `sim_post_${randomUUID().slice(0, 10)}`;
    return {
      externalId,
      externalUrl: `${PLATFORM_URL_PREFIX[this.platform]}_${externalId}`,
      publishedAt: new Date(),
      simulated: true,
      rawResponse: {
        simulated: true,
        platform: this.platform,
        body: input.body,
        mediaCount: input.mediaUrls.length,
        publishedAt: new Date().toISOString(),
      },
    };
  }

  async getPostStatus(externalId: string): Promise<PostStatus> {
    return {
      status: "PUBLISHED",
      externalUrl: `${PLATFORM_URL_PREFIX[this.platform]}_${externalId}`,
    };
  }

  async deleteScheduledPost(): Promise<void> {
    return;
  }

  async fetchAnalytics(input: FetchAnalyticsInput): Promise<PlatformMetrics[]> {
    void input;
    // Métricas simuladas con algo de variabilidad para que el dashboard de
    // analítica tenga datos con los que trabajar.
    const impressions = 400 + Math.floor(Math.random() * 3200);
    const engagementRate = 0.02 + Math.random() * 0.06;
    return [
      {
        capturedAt: new Date(),
        impressions,
        reach: Math.round(impressions * 0.82),
        likes: Math.round(impressions * engagementRate * 0.7),
        comments: Math.round(impressions * engagementRate * 0.1),
        shares: Math.round(impressions * engagementRate * 0.08),
        saves: Math.round(impressions * engagementRate * 0.12),
        clicks: Math.round(impressions * engagementRate * 0.25),
        videoViews: this.platform === "TIKTOK" ? Math.round(impressions * 0.9) : undefined,
        watchTimeSeconds: this.platform === "TIKTOK" ? Math.round(impressions * 4.2) : undefined,
        newFollowers: Math.round(impressions * 0.004),
      },
    ];
  }
}
