import type { SocialPlatform } from "@/lib/enums";

/**
 * Metricool usa sus propios identificadores de red, distintos de nuestro
 * `SocialPlatform`. En particular X/Twitter sigue llamándose "twitter" en su
 * API. Confirmado leyendo el código fuente de un cliente de la API
 * (github.com/Purple-Horizons/metricool-cli) — ver INTEGRATIONS.md.
 */
export const PLATFORM_TO_METRICOOL_NETWORK: Record<SocialPlatform, string> = {
  LINKEDIN: "linkedin",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  THREADS: "threads",
  X: "twitter",
};
