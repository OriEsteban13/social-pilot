const MAX_CHARS = 6000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Descarga una URL pública y extrae texto plano aproximado (sin parser HTML
 * completo — solo lo justo para alimentar el análisis de marca con IA). Si
 * la petición falla o la página no es HTML, devuelve `null` en lugar de
 * lanzar, para que el llamante pueda degradar a "needsValidation".
 *
 * Normaliza el input (añade `https://` si falta) y, si el primer intento
 * falla, reintenta una vez alternando el prefijo "www." — es un caso real
 * frecuente: dominios donde solo uno de los dos (con o sin "www") tiene
 * registro DNS, y el otro falla con "no se pudo resolver el host".
 */
export async function fetchWebsiteText(url: string): Promise<string | null> {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  const primary = await tryFetch(normalized);
  if (primary) return primary;

  const alternate = toggleWwwPrefix(normalized);
  if (alternate) return tryFetch(alternate);

  return null;
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export function toggleWwwPrefix(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.startsWith("www.") ? parsed.hostname.slice(4) : `www.${parsed.hostname}`;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CamaleonicSocialPilot/1.0 (+brand-brain-analysis)" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) return null;
    return text.slice(0, MAX_CHARS);
  } catch {
    return null;
  }
}
