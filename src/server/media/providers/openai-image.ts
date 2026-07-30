import type { GenerateImageInput, GeneratedImage, ImageAspectRatio, ImageProvider } from "../types";
import { isSupabaseStorageConfigured, uploadPublicAsset } from "@/server/storage/supabase-storage";

/**
 * Proveedor de imagen real usando la API de imágenes de OpenAI
 * (`gpt-image-1`). Se activa con `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`
 * — ver .env.example. Anthropic no ofrece generación de imágenes, así que
 * esta es la pieza que falta para completar "IA + imagen" con proveedores
 * reales (ver INTEGRATIONS.md).
 *
 * Nota: la API de imágenes de OpenAI solo admite un conjunto fijo de
 * tamaños (cuadrado, retrato, paisaje) — no permite un ratio arbitrario, así
 * que cada `ImageAspectRatio` del dominio se mapea al tamaño soportado más
 * cercano (ver `mapAspectRatioToSize`). Esta implementación no se ha podido
 * probar contra la API real en este entorno (no hay `OPENAI_API_KEY`
 * configurada) — antes de darla por buena en producción, verifica una
 * llamada real y confirma que la forma de la respuesta (`b64_json` o `url`
 * en `data[0]`) coincide con la documentación vigente de OpenAI.
 *
 * `gpt-image-1` no ofrece opción de URL: siempre devuelve la imagen en
 * base64. Si Supabase Storage está configurado, se sube ahí y se devuelve
 * una URL pública real (necesario para Metricool, que rechaza `data:`
 * URIs); si no, se mantiene como `data:` URI — válido para previsualizar en
 * la app, pero incompatible con `SOCIAL_PROVIDER=metricool`.
 */

const OPENAI_IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";

interface OpenAIImageSize {
  api: "1024x1024" | "1024x1536" | "1536x1024";
  width: number;
  height: number;
}

export function mapAspectRatioToSize(ratio: ImageAspectRatio): OpenAIImageSize {
  switch (ratio) {
    case "1:1":
      return { api: "1024x1024", width: 1024, height: 1024 };
    case "4:5":
    case "9:16":
      return { api: "1024x1536", width: 1024, height: 1536 };
    case "16:9":
    case "1.91:1":
      return { api: "1536x1024", width: 1536, height: 1024 };
  }
}

function buildPrompt(input: GenerateImageInput): string {
  const parts = [
    input.prompt,
    input.headline ? `Incluye el titular "${input.headline}" integrado de forma legible en el diseño.` : null,
    input.subheadline ? `Subtítulo: "${input.subheadline}".` : null,
    `Aplica la identidad visual de ${input.brandName}, usando estos colores de marca: ${input.brandColors.join(", ")}.`,
    "Estilo: imagen para publicación en redes sociales, limpia, profesional, sin texto adicional que no se haya pedido.",
  ].filter(Boolean);
  return parts.join(" ");
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai";

  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no está configurada. Define IMAGE_PROVIDER=mock, o añade la clave para usar IMAGE_PROVIDER=openai."
      );
    }

    const size = mapAspectRatioToSize(input.aspectRatio);

    const response = await fetch(OPENAI_IMAGES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: buildPrompt(input),
        size: size.api,
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message = errorBody?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`OpenAI Images (generateImage): ${message}`);
    }

    const payload = await response.json();
    const item = payload?.data?.[0];
    if (!item) {
      throw new Error("OpenAI Images (generateImage): respuesta sin datos de imagen.");
    }

    let url: string | undefined = item.url;
    if (!url && item.b64_json) {
      url = isSupabaseStorageConfigured()
        ? await uploadPublicAsset({ data: Buffer.from(item.b64_json, "base64"), contentType: "image/png", extension: "png", folder: "openai-images" })
        : `data:image/png;base64,${item.b64_json}`;
    }
    if (!url) {
      throw new Error("OpenAI Images (generateImage): no se encontró 'b64_json' ni 'url' en la respuesta.");
    }

    return { url, width: size.width, height: size.height, provider: this.id };
  }
}
