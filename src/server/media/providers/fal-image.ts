import { fal } from "@fal-ai/client";
import type { GenerateImageInput, GeneratedImage, ImageAspectRatio, ImageProvider } from "../types";
import { describeFalError } from "./fal-error";

/**
 * Proveedor de imagen real vía fal.ai (https://fal.ai), usando Flux por
 * defecto. Se activa con `IMAGE_PROVIDER=fal` + `FAL_KEY` — ver
 * .env.example e INTEGRATIONS.md. fal.ai agrega cientos de modelos (Flux,
 * Kling, Wan, Hailuo...) bajo una única API de pago por uso, sin
 * suscripción — es también quien alimenta a `FalVideoProvider`.
 *
 * Verificado contra la documentación oficial de fal.ai antes de escribir
 * este archivo: auth (`Authorization: Key $FAL_KEY`, gestionada por el
 * cliente oficial `@fal-ai/client`), el modelo `fal-ai/flux/schnell` y su
 * esquema de entrada/salida. Probado contra una cuenta real: la petición
 * llega bien y se autentica correctamente (confirmado con una cuenta sin
 * saldo, que devuelve un 403 con detalle claro en vez de un error de auth) —
 * pendiente de una generación completa con saldo cargado.
 */

interface FluxImageResult {
  images: { url: string; width: number; height: number }[];
}

export const DIMENSIONS: Record<ImageAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1280, height: 720 },
  "1.91:1": { width: 1200, height: 628 },
};

function getModel(): string {
  return process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell";
}

export function buildPrompt(input: GenerateImageInput): string {
  const parts = [
    input.prompt,
    input.headline ? `Incluye el titular "${input.headline}" integrado de forma legible en el diseño.` : null,
    input.subheadline ? `Subtítulo: "${input.subheadline}".` : null,
    `Aplica la identidad visual de ${input.brandName}, con estos colores de marca: ${input.brandColors.join(", ")}.`,
    "Estilo: imagen para publicación en redes sociales, limpia, profesional, sin texto adicional que no se haya pedido.",
  ].filter(Boolean);
  return parts.join(" ");
}

export class FalImageProvider implements ImageProvider {
  readonly id = "fal";

  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY no está configurada. Define IMAGE_PROVIDER=mock, o añade la clave para usar IMAGE_PROVIDER=fal.");
    }

    const size = DIMENSIONS[input.aspectRatio];

    try {
      const result = await fal.subscribe(getModel(), {
        input: {
          prompt: buildPrompt(input),
          image_size: size,
          num_images: 1,
          output_format: "png",
        },
      });

      const data = result.data as FluxImageResult;
      const image = data.images?.[0];
      if (!image) throw new Error("fal.ai no devolvió ninguna imagen en la respuesta.");

      return { url: image.url, width: image.width, height: image.height, provider: this.id };
    } catch (error) {
      throw new Error(`fal.ai (generateImage): ${describeFalError(error)}`);
    }
  }
}
