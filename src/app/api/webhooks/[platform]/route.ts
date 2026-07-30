import { NextResponse } from "next/server";
import { SOCIAL_PLATFORMS } from "@/lib/enums";

/**
 * Punto de entrada para webhooks entrantes de cada red social (actualización
 * de estado de publicación, revocación de tokens, etc.). Ninguna de las 5
 * plataformas tiene credenciales reales configuradas todavía en este
 * entorno (ver INTEGRATIONS.md), así que este handler solo valida la forma
 * de la petición y confirma la recepción — la lógica de actualización de
 * `PublishedPost`/`SocialAccount` se conecta aquí cuando exista integración
 * real por plataforma.
 */
export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const normalized = platform.toUpperCase();

  if (!SOCIAL_PLATFORMS.includes(normalized as (typeof SOCIAL_PLATFORMS)[number])) {
    return NextResponse.json({ error: `Plataforma desconocida: ${platform}` }, { status: 404 });
  }

  // TODO: cuando se active el adaptador real de `normalized`, verificar la
  // firma del webhook y actualizar PublishedPost/SocialAccount según el payload.
  await request.text().catch(() => undefined);

  return NextResponse.json({ received: true, platform: normalized, simulated: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  return NextResponse.json({ ok: true, platform, message: "Webhook endpoint activo (modo simulado)." });
}
