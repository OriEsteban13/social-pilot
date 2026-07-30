import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Sube un archivo a Supabase Storage y devuelve su URL pública. Existe para
 * que los proveedores de IA que devuelven el archivo en base64 (p.ej.
 * `OpenAIImageProvider`, cuyo modelo `gpt-image-1` no ofrece una opción de
 * URL) puedan producir una URL real en vez de un `data:` URI — imprescindible
 * para publicar vía Metricool, que no acepta `data:` URIs. Ver
 * INTEGRATIONS.md.
 *
 * Requiere un bucket público ya creado en el proyecto de Supabase — esto no
 * se puede provisionar desde aquí, hay que crearlo a mano en el panel de
 * Supabase (Storage → New bucket → marcar "Public"). Nombre por defecto
 * "media", configurable con `SUPABASE_STORAGE_BUCKET`.
 */

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  // La service role key salta las políticas RLS — solo debe usarse en
  // código de servidor (nunca en el cliente), como aquí.
  return createClient(url, serviceRoleKey);
}

export async function uploadPublicAsset(params: { data: Buffer; contentType: string; extension: string; folder: string }): Promise<string> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media";
  const client = getClient();
  const path = `${params.folder}/${Date.now()}-${randomUUID()}.${params.extension}`;

  const { error } = await client.storage.from(bucket).upload(path, params.data, {
    contentType: params.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase Storage (upload a ${bucket}/${path}): ${error.message}`);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
