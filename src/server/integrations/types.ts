import type { SocialPlatform } from "@/lib/enums";

/**
 * Interfaz común a las 5 redes sociales soportadas. Cada plataforma tiene su
 * propia implementación (src/server/integrations/<platform>/adapter.ts).
 * Mientras no existan credenciales reales, `registry.ts` resuelve siempre al
 * `SimulatedAdapter`, que implementa exactamente esta misma interfaz. Ver
 * INTEGRATIONS.md para el estado y las limitaciones de cada API oficial.
 */

export interface ConnectAccountInput {
  workspaceId: string;
  oauthCode?: string;
  redirectUri?: string;
}

export interface SocialAccountRef {
  externalAccountId: string;
  handle: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  status: "CONNECTED" | "EXPIRED" | "ERROR" | "DISCONNECTED";
  message?: string;
}

export interface CreatePostInput {
  accountRef: { externalAccountId: string };
  body: string;
  mediaUrls: string[];
  format: string;
  hashtags: string[];
}

export interface DraftPostRef {
  draftId: string;
}

export interface UploadMediaInput {
  accountRef: { externalAccountId: string };
  url: string;
  mimeType: string;
}

export interface MediaRef {
  mediaId: string;
  url: string;
}

export interface SchedulePostInput extends CreatePostInput {
  scheduledAt: Date;
  idempotencyKey: string;
}

export interface ScheduledPostRef {
  externalId: string;
  status: "SCHEDULED" | "MANUAL_REQUIRED";
  reason?: string;
}

export interface PublishPostInput extends CreatePostInput {
  idempotencyKey: string;
}

export interface PublishedPostRef {
  externalId: string;
  externalUrl: string;
  publishedAt: Date;
  simulated: boolean;
  rawResponse: Record<string, unknown>;
}

export interface PostStatus {
  status: "PENDING" | "PUBLISHED" | "FAILED" | "MANUAL_REQUIRED";
  externalUrl?: string;
  error?: string;
}

export interface FetchAnalyticsInput {
  externalId: string;
  since?: Date;
}

export interface PlatformMetrics {
  capturedAt: Date;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  videoViews?: number;
  watchTimeSeconds?: number;
  newFollowers?: number;
}

export interface SocialAdapter {
  readonly platform: SocialPlatform;
  readonly simulated: boolean;
  connectAccount(input: ConnectAccountInput): Promise<SocialAccountRef>;
  refreshToken(refreshToken: string): Promise<TokenRefreshResult>;
  validateConnection(externalAccountId: string): Promise<ConnectionStatus>;
  createPost(input: CreatePostInput): Promise<DraftPostRef>;
  uploadMedia(input: UploadMediaInput): Promise<MediaRef>;
  schedulePost(input: SchedulePostInput): Promise<ScheduledPostRef>;
  publishPost(input: PublishPostInput): Promise<PublishedPostRef>;
  getPostStatus(externalId: string): Promise<PostStatus>;
  deleteScheduledPost(externalId: string): Promise<void>;
  fetchAnalytics(input: FetchAnalyticsInput): Promise<PlatformMetrics[]>;
}
