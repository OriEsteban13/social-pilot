import type { SocialPlatform } from "@/lib/enums";
import { SOCIAL_PLATFORMS } from "@/lib/enums";
import type { SocialAdapter } from "./types";
import { SimulatedAdapter } from "./simulated-adapter";
import { MetricoolAdapter } from "./metricool/adapter";

/**
 * Resuelve el adaptador activo para las 5 redes. Controlado por
 * `SOCIAL_PROVIDER`:
 *   - "simulated" (por defecto): `SimulatedAdapter`, sin llamadas externas.
 *   - "metricool": `MetricoolAdapter`, una única integración real para las 5
 *     redes vía la API de Metricool (plan Advanced) — ver INTEGRATIONS.md.
 *
 * A diferencia del plan original (un adaptador nativo por red, con flags
 * `<PLATFORM>_ENABLED` independientes), Metricool cubre las 5 plataformas
 * con una sola cuenta/API, así que el interruptor es único y no por red. Si
 * en el futuro se añade un adaptador nativo directo para alguna plataforma
 * concreta, este switch puede volver a ser por plataforma sin tocar
 * ningún servicio que consuma `getSocialAdapter()`.
 */

const cache = new Map<SocialPlatform, SocialAdapter>();

export function getSocialAdapter(platform: SocialPlatform): SocialAdapter {
  const existing = cache.get(platform);
  if (existing) return existing;

  const provider = process.env.SOCIAL_PROVIDER ?? "simulated";
  const adapter: SocialAdapter = provider === "metricool" ? new MetricoolAdapter(platform) : new SimulatedAdapter(platform);

  cache.set(platform, adapter);
  return adapter;
}

export function getAllSocialAdapters(): Record<SocialPlatform, SocialAdapter> {
  return Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, getSocialAdapter(p)])) as Record<
    SocialPlatform,
    SocialAdapter
  >;
}
