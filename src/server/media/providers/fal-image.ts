import { fal } from "@fal-ai/client";
import type { GenerateImageInput, GeneratedImage, ImageAspectRatio, ImageProvider } from "../types";
import { describeFalError } from "./fal-error";

/**
 * Proveedor de imagen real vía fal.ai (https://fal.ai). Se activa con
 * `IMAGE_PROVIDER=fal` + `FAL_KEY` — ver .env.example e INTEGRATIONS.md.
 * fal.ai agrega cientos de modelos bajo una única API de pago por uso, sin
 * suscripción — es también quien alimenta a `FalVideoProvider`.
 *
 * Modelo por defecto: `fal-ai/recraft/v3/text-to-image`, NO `flux/schnell`.
 * Probado contra una cuenta real con las dos opciones: `flux/schnell` genera
 * rápido y barato, pero renderiza el titular con errores tipográficos
 * (letras de más, palabras cambiadas) y no respeta los colores de marca
 * pedidos con precisión — inaceptable para posts con texto integrado, que es
 * el caso de uso principal aquí. Recraft V3 (`style: "digital_illustration"`)
 * renderiza el texto perfecto y sí sigue los colores/estilo pedidos; algo
 * más caro (~0.04$/imagen) pero es el que realmente hay que usar en
 * producción para contenido de marca. `FAL_IMAGE_MODEL` permite cambiarlo
 * (p.ej. volver a `flux/schnell` para bocetos rápidos sin texto).
 *
 * Nota: `style: "vector_illustration"` de Recraft da un resultado aún más
 * cercano a un sistema de diseño plano (probado y descartado por ahora): la
 * respuesta es un `.svg`, no compatible con la subida a redes sociales vía
 * Metricool (necesita raster), y en la prueba coló un texto de la propia
 * instrucción de estilo como si fuera parte del diseño.
 */

interface RecraftImageResult {
  images: { url: string }[];
}

export const DIMENSIONS: Record<ImageAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1280, height: 720 },
  "1.91:1": { width: 1200, height: 628 },
};

function getModel(): string {
  return process.env.FAL_IMAGE_MODEL || "fal-ai/recraft/v3/text-to-image";
}

/**
 * Convierte un hex a un nombre de color aproximado en lenguaje natural.
 * Necesario porque Recraft (y otros modelos con buen renderizado de texto)
 * tienden a "leer" cualquier código hex (#1f3a2e...) presente en el prompt y
 * dibujarlo literalmente como texto en la imagen, en vez de tratarlo solo
 * como una instrucción de color — visto en pruebas reales. Clasificación
 * aproximada por matiz/luminosidad/saturación en HSL, suficiente para guiar
 * al modelo (no necesita ser exacta).
 */
export function describeColor(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const int = Number.parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  // Se usa `delta` (dispersión bruta entre canales RGB) en vez de la
  // "saturation" normalizada de HSL para detectar colores casi acromáticos:
  // la fórmula de saturación de HSL se dispara para luminosidades cercanas a
  // 0 o 1 incluso con un delta mínimo (p.ej. un crema casi blanco salía
  // clasificado como "amarillo pastel" en vez de "blanco roto").
  if (delta < 0.08) {
    if (lightness > 0.9) return "blanco roto";
    if (lightness > 0.65) return "gris claro";
    if (lightness > 0.35) return "gris medio";
    return "gris muy oscuro / casi negro";
  }

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = ((hue * 60) + 360) % 360;

  const depth = lightness < 0.25 ? "muy oscuro" : lightness < 0.45 ? "oscuro" : lightness > 0.85 ? "muy claro/pastel" : lightness > 0.65 ? "claro" : "";
  let family: string;
  if (hue < 15 || hue >= 345) family = "rojo";
  else if (hue < 45) family = lightness < 0.55 ? "terracota/naranja quemado" : "naranja cálido";
  else if (hue < 65) family = "amarillo mostaza";
  else if (hue < 170) family = lightness < 0.4 ? "verde bosque" : "verde salvia";
  else if (hue < 200) family = "verde azulado / teal";
  else if (hue < 250) family = "azul";
  else if (hue < 290) family = "índigo/púrpura";
  else if (hue < 345) family = "malva/rosa";
  else family = "neutro";

  return depth ? `${family} ${depth}` : family;
}

export function buildPrompt(input: GenerateImageInput): string {
  const colorNames = input.brandColors.map(describeColor).join(", ");
  const parts = [
    input.prompt,
    input.headline ? `Incluye el titular "${input.headline}" como único texto grande y legible del diseño.` : null,
    input.subheadline ? `Como texto secundario más pequeño: "${input.subheadline}".` : null,
    `Paleta de color de la marca ${input.brandName} — usa solo estos tonos, sin escribir sus nombres ni códigos en la imagen: ${colorNames}.`,
    // Estilo genérico (boutique SaaS editorial), en prosa corta para no
    // arrastrar frases sueltas que el modelo pueda malinterpretar como texto
    // a renderizar: tipografía serif grande para el titular, un bloque de
    // color sólido de fondo, un acento geométrico discreto, mucho espacio
    // en blanco, nada de ilustraciones de personas ni logos inventados.
    "Estilo editorial minimalista de producto SaaS premium: tipografía serif elegante para el titular, fondo de color sólido, como mucho un acento geométrico simple (círculo o línea fina), composición limpia con mucho espacio en blanco. No añadas logotipos, marcas, personas ilustradas, iconos de producto ni ningún texto que no sea el titular indicado.",
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
          style: "digital_illustration",
        },
      });

      const data = result.data as RecraftImageResult;
      const image = data.images?.[0];
      if (!image) throw new Error("fal.ai no devolvió ninguna imagen en la respuesta.");

      // Recraft no devuelve width/height en la respuesta (a diferencia de
      // Flux) — se usa el tamaño pedido, que es el que realmente genera.
      return { url: image.url, width: size.width, height: size.height, provider: this.id };
    } catch (error) {
      throw new Error(`fal.ai (generateImage): ${describeFalError(error)}`);
    }
  }
}
