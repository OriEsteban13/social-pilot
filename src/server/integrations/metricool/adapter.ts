import { prisma } from "@/server/db/client";
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
} from "../types";
import { metricoolRequest, encodeMetricoolId, decodeMetricoolId, MetricoolApiError } from "./client";
import { PLATFORM_TO_METRICOOL_NETWORK } from "./networks";

/**
 * Adaptador real contra la API de Metricool (plan Advanced, ~43€/mes),
 * activado con `SOCIAL_PROVIDER=metricool`. Cubre las 5 redes con una única
 * integración: Metricool ya tiene sus propias apps aprobadas por cada
 * plataforma, así que aquí no hay OAuth propio que gestionar — el cliente
 * conecta sus cuentas directamente en la interfaz de Metricool, y este
 * adaptador solo lee/escribe a través de su API.
 *
 * Rutas, autenticación y forma de los payloads verificadas contra el código
 * fuente de un cliente de referencia de esta API
 * (github.com/Purple-Horizons/metricool-cli) antes de escribir este archivo,
 * ya que Metricool no publica un SDK oficial de Node ni ejemplos de
 * respuesta completos. Los nombres de campo de las RESPUESTAS (ids de post,
 * forma exacta de las conexiones/analítica) no se han podido confirmar
 * contra una cuenta real todavía — el parseo es defensivo (varios nombres
 * candidatos) y debe verificarse en cuanto haya credenciales reales. Ver
 * INTEGRATIONS.md.
 */

interface MetricoolConnection {
  network?: string;
  id?: string | number;
  externalId?: string | number;
  username?: string;
  handle?: string;
  name?: string;
  displayName?: string;
  status?: string;
  active?: boolean;
}

function firstDefined<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const v of values) if (v !== undefined && v !== null) return v;
  return undefined;
}

async function getWorkspaceBlogId(workspaceId: string): Promise<string> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { metricoolBlogId: true, name: true } });
  if (!workspace?.metricoolBlogId) {
    throw new Error(
      `La empresa "${workspace?.name ?? workspaceId}" no tiene configurado un Brand ID de Metricool. Añádelo en Configuración antes de conectar redes.`
    );
  }
  return workspace.metricoolBlogId;
}

/**
 * `GET /v2/settings/brands/{blogId}/connections` (usado aquí hasta julio de
 * 2026, verificado contra el CLI de referencia) devuelve 404 contra la API
 * real — parece haberse retirado. `GET /v2/settings/brands/{blogId}` (sin el
 * sufijo) sí responde 200 y trae la info en `data.networksData`, un objeto
 * indexado por red pero con la clave `"<red>Data"` (p.ej. `tiktokData`, no
 * `tiktok`) — mismo patrón que ya usa `createPost` para `linkedinData`/
 * `instagramData` en el body. Verificado con una cuenta real con TikTok
 * conectado: `{ tiktokData: { username, providerUserId, accountType,
 * profileURL, picture } }` — sin campos `id`/`active`/`status` (no hacen
 * falta: `externalAccountId` se construye a partir de blogId+red, no de esto;
 * `username` sí está presente y es lo único que se usa de aquí para mostrar
 * el handle).
 */
export async function findConnection(blogId: string, network: string): Promise<MetricoolConnection | null> {
  const data = await metricoolRequest<unknown>(`/v2/settings/brands/${blogId}`, { blogId });
  const brand = (data as { data?: { networksData?: unknown } })?.data;
  const networksData = brand?.networksData;
  if (!networksData || typeof networksData !== "object") return null;

  const entry = (networksData as Record<string, unknown>)[`${network}Data`];
  if (!entry || typeof entry !== "object") return null;

  return { network, ...(entry as Record<string, unknown>) } as MetricoolConnection;
}

export class MetricoolAdapter implements SocialAdapter {
  readonly simulated = false;

  constructor(readonly platform: SocialPlatform) {}

  private get network(): string {
    return PLATFORM_TO_METRICOOL_NETWORK[this.platform];
  }

  async connectAccount(input: ConnectAccountInput): Promise<SocialAccountRef> {
    const blogId = await getWorkspaceBlogId(input.workspaceId);
    const connection = await findConnection(blogId, this.network);

    if (!connection) {
      throw new Error(
        `${this.platform} no está conectado en Metricool para esta empresa (Brand ID ${blogId}). Conéctalo primero desde app.metricool.com y vuelve a intentarlo aquí.`
      );
    }

    return {
      externalAccountId: encodeMetricoolId(blogId, this.network),
      handle: firstDefined(connection.username, connection.handle, connection.name) ?? this.network,
      displayName: firstDefined(connection.displayName, connection.name, connection.username) ?? `${this.platform} (Metricool)`,
      // Metricool gestiona el token real con cada red; nosotros solo guardamos el token de cuenta de Metricool (uno solo, compartido — ver METRICOOL_USER_TOKEN), no un token por red.
      accessToken: "metricool-managed",
      scopes: ["metricool"],
    };
  }

  async refreshToken(): Promise<TokenRefreshResult> {
    // Metricool renueva internamente su propia conexión OAuth con cada red;
    // nunca vemos ni gestionamos ese token nosotros.
    return { accessToken: "metricool-managed" };
  }

  async validateConnection(externalAccountId: string): Promise<ConnectionStatus> {
    const { blogId } = decodeMetricoolId(externalAccountId);
    try {
      const connection = await findConnection(blogId, this.network);
      if (!connection) return { connected: false, status: "DISCONNECTED", message: "No conectado en Metricool." };
      const active = connection.active !== false && connection.status?.toLowerCase() !== "expired";
      return active
        ? { connected: true, status: "CONNECTED" }
        : { connected: false, status: "EXPIRED", message: "La conexión en Metricool ha caducado; reconéctala en app.metricool.com." };
    } catch (error) {
      return { connected: false, status: "ERROR", message: error instanceof Error ? error.message : "Error desconocido." };
    }
  }

  async createPost(input: CreatePostInput): Promise<DraftPostRef> {
    const { blogId } = decodeMetricoolId(input.accountRef.externalAccountId);
    const post = await this.schedulerRequest(blogId, {
      text: buildText(input.body, input.hashtags),
      media: input.mediaUrls,
      draft: true,
      autoPublish: false,
      publicationDate: nowPublicationDate(),
    });
    return { draftId: encodeMetricoolId(blogId, extractPostId(post)) };
  }

  async uploadMedia(input: UploadMediaInput): Promise<MediaRef> {
    const { blogId } = decodeMetricoolId(input.accountRef.externalAccountId);
    if (input.url.startsWith("data:")) {
      throw new Error(
        "Metricool necesita una URL pública para la imagen (no admite data: URIs). Configura Supabase Storage (o similar) antes de generar imágenes con IA cuando SOCIAL_PROVIDER=metricool esté activo."
      );
    }
    const normalized = await metricoolRequest<unknown>("/actions/normalize/image/url", { blogId, query: { url: input.url } });
    const url = typeof normalized === "string" ? normalized : firstDefined((normalized as { url?: string })?.url, input.url)!;
    return { mediaId: url, url };
  }

  async schedulePost(input: SchedulePostInput): Promise<ScheduledPostRef> {
    const { blogId } = decodeMetricoolId(input.accountRef.externalAccountId);
    const post = await this.schedulerRequest(blogId, {
      text: buildText(input.body, input.hashtags),
      media: input.mediaUrls,
      draft: false,
      autoPublish: true,
      publicationDate: toPublicationDate(input.scheduledAt),
    });
    return { externalId: encodeMetricoolId(blogId, extractPostId(post)), status: "SCHEDULED" };
  }

  async publishPost(input: PublishPostInput): Promise<PublishedPostRef> {
    const { blogId } = decodeMetricoolId(input.accountRef.externalAccountId);
    const post = await this.schedulerRequest(blogId, {
      text: buildText(input.body, input.hashtags),
      media: input.mediaUrls,
      draft: false,
      autoPublish: true,
      publicationDate: nowPublicationDate(),
    });
    const postId = extractPostId(post);

    return {
      externalId: encodeMetricoolId(blogId, postId),
      // Metricool no devuelve la URL final de la red social en la respuesta de creación (la
      // publicación real la ejecuta su propio scheduler poco después) — hasta verificar el
      // flujo completo contra una cuenta real, enlazamos al propio planner de Metricool en
      // vez de inventar una URL de la red social. Ver comentario en el docstring del archivo.
      externalUrl: `https://app.metricool.com/planning/posts?blogId=${blogId}`,
      publishedAt: new Date(),
      simulated: false,
      rawResponse: (post as Record<string, unknown>) ?? {},
    };
  }

  async getPostStatus(externalId: string): Promise<PostStatus> {
    const { blogId, resourceId } = decodeMetricoolId(externalId);
    try {
      const post = await metricoolRequest<Record<string, unknown>>(`/v2/scheduler/posts/${resourceId}`, { blogId });
      const status = String(firstDefined(post?.status, post?.state, "")).toLowerCase();
      if (status.includes("error") || status.includes("fail")) return { status: "FAILED", error: JSON.stringify(post) };
      if (status.includes("publish") || status.includes("done") || status.includes("sent")) {
        return { status: "PUBLISHED", externalUrl: `https://app.metricool.com/planning/posts?blogId=${blogId}` };
      }
      return { status: "PENDING" };
    } catch (error) {
      return { status: "FAILED", error: error instanceof Error ? error.message : "Error desconocido." };
    }
  }

  async deleteScheduledPost(externalId: string): Promise<void> {
    const { blogId, resourceId } = decodeMetricoolId(externalId);
    await metricoolRequest(`/v2/scheduler/posts/${resourceId}`, { method: "DELETE", blogId });
  }

  async fetchAnalytics(input: FetchAnalyticsInput): Promise<PlatformMetrics[]> {
    const { blogId, resourceId } = decodeMetricoolId(input.externalId);
    const since = input.since ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

    const data = await metricoolRequest<unknown>(`/v2/analytics/posts/${this.network}`, {
      blogId,
      query: { from: since.toISOString(), to: new Date().toISOString() },
    });

    const posts: Record<string, unknown>[] = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : Array.isArray((data as { posts?: unknown })?.posts)
        ? ((data as { posts: unknown[] }).posts as Record<string, unknown>[])
        : [];

    const match = posts.find((p) => String(firstDefined(p.id, p.postId, p.externalId)) === resourceId);
    if (!match) return [];

    const num = (...keys: string[]): number | undefined => {
      for (const key of keys) {
        const value = match[key];
        if (typeof value === "number") return value;
      }
      return undefined;
    };

    return [
      {
        capturedAt: new Date(),
        impressions: num("impressions", "impresions"),
        reach: num("reach"),
        likes: num("likes"),
        comments: num("comments"),
        shares: num("shares", "shared"),
        saves: num("saves", "saved"),
        clicks: num("clicks", "linkClicks"),
        videoViews: num("videoViews", "views", "plays"),
        watchTimeSeconds: num("watchTime", "videoWatchTime"),
        newFollowers: num("newFollowers", "followers"),
      },
    ];
  }

  private async schedulerRequest(
    blogId: string,
    payload: {
      text: string;
      media: string[];
      draft: boolean;
      autoPublish: boolean;
      publicationDate: { dateTime: string; timezone: string };
    }
  ): Promise<unknown> {
    const dataUri = payload.media.find((url) => url.startsWith("data:"));
    if (dataUri) {
      throw new Error(
        "Metricool necesita URLs públicas para los medios adjuntos (no admite data: URIs). Configura Supabase Storage (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) o usa IMAGE_PROVIDER=fal, que ya devuelve una URL real."
      );
    }

    try {
      return await metricoolRequest("/v2/scheduler/posts", {
        method: "POST",
        blogId,
        body: {
          text: payload.text,
          providers: [{ network: this.network }],
          publicationDate: payload.publicationDate,
          draft: payload.draft,
          autoPublish: payload.autoPublish,
          media: payload.media,
        },
      });
    } catch (error) {
      if (error instanceof MetricoolApiError) {
        throw new Error(`Metricool rechazó la publicación en ${this.platform}: ${error.body || error.message}`);
      }
      throw error;
    }
  }
}

export function buildText(body: string, hashtags: string[]): string {
  return hashtags.length ? `${body}\n\n${hashtags.join(" ")}` : body;
}

function nowPublicationDate(): { dateTime: string; timezone: string } {
  return toPublicationDate(new Date());
}

export function toPublicationDate(date: Date): { dateTime: string; timezone: string } {
  return {
    dateTime: date.toISOString().split(".")[0],
    timezone: process.env.METRICOOL_TIMEZONE || "Europe/Madrid",
  };
}

export function extractPostId(response: unknown): string {
  const obj = response as Record<string, unknown> | undefined;
  const id = firstDefined(obj?.id, obj?.postId, (obj?.data as Record<string, unknown> | undefined)?.id);
  if (id === undefined) {
    throw new Error(`No se pudo extraer el id del post de la respuesta de Metricool: ${JSON.stringify(response)}`);
  }
  return String(id);
}
