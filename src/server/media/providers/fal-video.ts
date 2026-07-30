import { fal } from "@fal-ai/client";
import type { GenerateVideoInput, GeneratedVideoAsset, VideoProvider } from "../types";
import { MockImageProvider } from "./mock-image";
import { describeFalError } from "./fal-error";

/**
 * Proveedor de vídeo real vía fal.ai, con modelo configurable por
 * `FAL_VIDEO_MODEL` — ver .env.example e INTEGRATIONS.md:
 *   - "kling" (por defecto): Kling 2.1 Master, mejor calidad visual, ~$0.07/s.
 *   - "wan": Wan 2.5, más económico, ~$0.05/s a 480p.
 * Se activa con `VIDEO_PROVIDER=fal` + `FAL_KEY`.
 *
 * Verificado contra la documentación oficial de fal.ai antes de escribir
 * este archivo (modelo, esquema de entrada/salida de cada uno — ambos
 * comparten la forma de salida `{ video: { url } }`). No se ha podido
 * probar contra una cuenta real en este entorno (sin `FAL_KEY`).
 *
 * Importante — llamada síncrona: `fal.subscribe()` espera (con polling
 * interno) a que el vídeo termine de generarse antes de devolver el
 * resultado, lo que puede tardar bastante más que una petición HTTP normal.
 * Para el volumen de uso de este MVP se ha dejado como llamada directa
 * desde el Server Action que la invoca; si en producción se despliega en un
 * entorno serverless con límite de duración estricto (Vercel, etc.), esta
 * llamada debería moverse a la cola de jobs (`JobQueue` + `processDueJobs`)
 * que ya existe para la publicación, en vez de bloquear la petición.
 */

interface FalVideoResult {
  video: { url: string; width?: number; height?: number; duration?: number };
}

export const MODELS: Record<"kling" | "wan", string> = {
  kling: "fal-ai/kling-video/v2.1/master/text-to-video",
  wan: "fal-ai/wan-25-preview/text-to-video",
};

export function getModelKey(): "kling" | "wan" {
  const configured = process.env.FAL_VIDEO_MODEL;
  return configured === "wan" ? "wan" : "kling";
}

export function nearestSupportedDuration(seconds: number): "5" | "10" {
  return seconds > 7 ? "10" : "5";
}

export function buildPrompt(input: GenerateVideoInput): string {
  return [
    input.brief,
    `Vídeo corto para redes sociales de ${input.brandName}.`,
    `Estilo acorde a estos colores de marca: ${input.brandColors.join(", ")}.`,
    "Cámara estable, buena iluminación, ritmo dinámico, sin texto superpuesto salvo que se indique.",
  ].join(" ");
}

export class FalVideoProvider implements VideoProvider {
  readonly id = "fal";
  private readonly imageProvider = new MockImageProvider();

  async generateVideo(input: GenerateVideoInput): Promise<GeneratedVideoAsset> {
    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY no está configurada. Define VIDEO_PROVIDER=mock, o añade la clave para usar VIDEO_PROVIDER=fal.");
    }

    const modelKey = getModelKey();
    const model = MODELS[modelKey];
    const duration = nearestSupportedDuration(input.durationSeconds);
    const prompt = buildPrompt(input);

    const thumbnail = await this.imageProvider.generateImage({
      prompt: input.brief,
      aspectRatio: input.aspectRatio === "16:9" ? "16:9" : input.aspectRatio === "1:1" ? "1:1" : "9:16",
      headline: input.brief,
      brandName: input.brandName,
      brandColors: input.brandColors,
    });

    try {
      const result = await fal.subscribe(model, {
        input:
          modelKey === "kling"
            ? { prompt, duration, aspect_ratio: input.aspectRatio }
            : { prompt, duration, aspect_ratio: input.aspectRatio, resolution: "720p" },
      });

      const data = result.data as FalVideoResult;
      const video = data.video;
      if (!video?.url) throw new Error(`fal.ai (${model}) no devolvió ninguna URL de vídeo en la respuesta.`);

      return {
        status: "VIDEO_READY",
        script: prompt,
        storyboard: [{ scene: 1, description: input.brief, durationSeconds: Number(duration) }],
        thumbnailUrl: thumbnail.url,
        videoUrl: video.url,
        provider: `fal:${modelKey}`,
      };
    } catch (error) {
      throw new Error(`fal.ai (generateVideo, ${model}): ${describeFalError(error)}`);
    }
  }
}
