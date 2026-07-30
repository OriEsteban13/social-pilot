/**
 * Cliente HTTP mínimo para la API REST de Metricool
 * (https://app.metricool.com/api). No hay SDK oficial de Node, así que se
 * usa `fetch` directo — igual que hace el propio cliente de referencia que
 * se consultó para verificar rutas y payloads
 * (github.com/Purple-Horizons/metricool-cli, código fuente en `metricool.js`,
 * revisado antes de escribir este adaptador).
 *
 * Autenticación: query params `userToken` + `userId` (+ `blogId` cuando la
 * operación es sobre una marca concreta) y además la cabecera `X-Mc-Auth`
 * con el mismo token. Requiere plan Advanced o superior — ver
 * INTEGRATIONS.md.
 */

const BASE_URL = "https://app.metricool.com/api";

export class MetricoolConfigError extends Error {}
export class MetricoolApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
  }
}

function getCredentials(): { userToken: string; userId: string } {
  const userToken = process.env.METRICOOL_USER_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!userToken || !userId) {
    throw new MetricoolConfigError(
      "METRICOOL_USER_TOKEN y METRICOOL_USER_ID son obligatorios para usar SOCIAL_PROVIDER=metricool (Ajustes → cuenta de Metricool, plan Advanced o superior)."
    );
  }
  return { userToken, userId };
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const { userToken, userId } = getCredentials();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("userToken", userToken);
  url.searchParams.set("userId", userId);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function metricoolRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; blogId?: string; query?: Record<string, string | undefined> } = {}
): Promise<T> {
  const { userToken } = getCredentials();
  const url = buildUrl(path, { blogId: options.blogId, ...options.query });

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Mc-Auth": userToken,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new MetricoolApiError(`Metricool API ${options.method ?? "GET"} ${path}: HTTP ${response.status}`, response.status, text);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Algún endpoint (p.ej. normalize/image/url) puede devolver texto plano en vez de JSON.
    return text as unknown as T;
  }
}

/** Identificador compuesto usado internamente para poder recuperar el blogId a partir de un externalId/externalAccountId de una sola cadena — ver comentario en adapter.ts. */
export function encodeMetricoolId(blogId: string, resourceId: string): string {
  return `mc:${blogId}:${resourceId}`;
}

export function decodeMetricoolId(encoded: string): { blogId: string; resourceId: string } {
  const [prefix, blogId, ...rest] = encoded.split(":");
  const resourceId = rest.join(":");
  if (prefix !== "mc" || !blogId || !resourceId) {
    throw new Error(`Identificador de Metricool con formato inesperado: "${encoded}" (se esperaba "mc:<blogId>:<id>").`);
  }
  return { blogId, resourceId };
}
