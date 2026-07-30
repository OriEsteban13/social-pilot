import type { GenerateImageInput, GeneratedImage, ImageProvider } from "../types";
import { hashSeed, pick } from "@/lib/seeded-pick";

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1280, height: 720 },
  "1.91:1": { width: 1200, height: 628 },
};

const FONTS = {
  sansBold: "'Arial Black', Helvetica, Arial, sans-serif",
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  geometric: "'Century Gothic', Futura, Helvetica, sans-serif",
  mono: "'Courier New', monospace",
} as const;

type FontKey = keyof typeof FONTS;

// Anchura media aproximada de un carácter como fracción de su font-size, por
// fuente/peso — no son métricas reales (SVG no expone medición de texto en
// el servidor), pero acotan de forma conservadora para que las líneas no se
// salgan del lienzo, que es lo que pasaba antes con las fuentes más anchas.
const AVG_CHAR_WIDTH: Record<FontKey, number> = {
  sansBold: 0.64,
  sans: 0.52,
  serif: 0.52,
  geometric: 0.58,
  mono: 0.62,
};

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, maxLines);
}

/**
 * Ajusta el tamaño de letra del titular hasta que quepa en `maxLines` sin
 * perder texto (o hasta un mínimo razonable) — evita que un titular largo
 * se salga del lienzo o se corte a media palabra, que es lo que pasaba con
 * un tamaño de fuente fijo sin tener en cuenta la anchura real del texto.
 */
export function fitHeadline(text: string, availableWidthPx: number, baseFontSize: number, font: FontKey, maxLines: number): { lines: string[]; fontSize: number } {
  const factor = AVG_CHAR_WIDTH[font];
  let fontSize = baseFontSize;
  const minFontSize = baseFontSize * 0.55;

  for (let attempt = 0; attempt < 5; attempt++) {
    const maxChars = Math.max(8, Math.floor(availableWidthPx / (fontSize * factor)));
    const lines = wrapText(text, maxChars, maxLines);
    const coveredChars = lines.join(" ").length;
    const fitsFully = coveredChars >= text.length * 0.94;
    if (fitsFully || fontSize <= minFontSize) {
      return { lines, fontSize };
    }
    fontSize = Math.round(fontSize * 0.88);
  }
  const maxChars = Math.max(8, Math.floor(availableWidthPx / (fontSize * factor)));
  return { lines: wrapText(text, maxChars, maxLines), fontSize };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Contraste WCAG aproximado: decide texto blanco o casi negro según el brillo real del fondo, no una suposición fija. */
export function readableTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#ffffff";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#161616" : "#ffffff";
}

interface Palette {
  background: string;
  secondary: string;
  accent: string;
  text: string;
}

/**
 * Elige qué color de marca juega cada papel (fondo, secundario, acento) y
 * rota la asignación según `seed` — así la MISMA paleta de marca produce
 * combinaciones distintas entre una imagen y otra, en vez de fijar siempre
 * "los dos primeros colores" como fondo de un degradado (que es lo que
 * hacía que todas las imágenes se vieran iguales).
 */
export function resolvePalette(brandColors: string[], seed: number): Palette {
  const base = brandColors.filter(Boolean).length >= 2 ? brandColors.filter(Boolean) : ["#1f2937", "#4b5563"];
  const n = base.length;
  const rotation = seed % n;
  const rotated = [...base.slice(rotation), ...base.slice(0, rotation)];
  const background = rotated[0];
  const secondary = rotated[1 % n];
  const accent = rotated[2 % n] ?? secondary;
  return { background, secondary, accent, text: readableTextColor(background) };
}

interface TemplateContext {
  width: number;
  height: number;
  palette: Palette;
  headlineText: string;
  subheadline?: string;
  brandName: string;
  baseFontSize: number;
  seed: number;
}

function diagonalGradient(ctx: TemplateContext): string {
  const { width, height, palette, headlineText, subheadline, brandName, baseFontSize } = ctx;
  const availableWidth = width * 0.84;
  const { lines, fontSize } = fitHeadline(headlineText, availableWidth, baseFontSize, "sansBold", 3);
  const lineHeight = fontSize * 1.2;
  const startY = height * 0.3;
  return `
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.background}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <circle cx="${width * 0.88}" cy="${height * 0.12}" r="${width * 0.22}" fill="${palette.accent}" opacity="0.18" />
  <circle cx="${width * 0.06}" cy="${height * 0.92}" r="${width * 0.14}" fill="${palette.accent}" opacity="0.16" />
  ${lines
    .map(
      (line, i) =>
        `<text x="${width * 0.08}" y="${startY + i * lineHeight}" font-family="${FONTS.sansBold}" font-weight="800" font-size="${fontSize}" fill="${palette.text}">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subheadline ? `<text x="${width * 0.08}" y="${startY + lines.length * lineHeight + fontSize * 0.55}" font-family="${FONTS.sans}" font-size="${Math.round(fontSize * 0.42)}" fill="${palette.text}" opacity="0.85">${escapeXml(subheadline.slice(0, 70))}</text>` : ""}
  <rect x="${width * 0.08}" y="${height * 0.9}" width="${width * 0.1}" height="${Math.max(4, fontSize * 0.08)}" fill="${palette.accent}" />
  <text x="${width * 0.08}" y="${height * 0.96}" font-family="${FONTS.sans}" font-weight="600" font-size="${Math.round(baseFontSize * 0.4)}" fill="${palette.text}" opacity="0.85">${escapeXml(brandName)}</text>`;
}

function solidBlock(ctx: TemplateContext): string {
  const { width, height, palette, headlineText, subheadline, brandName, baseFontSize } = ctx;
  const barWidth = width * 0.025;
  const availableWidth = width * 0.82 - barWidth;
  const { lines, fontSize } = fitHeadline(headlineText, availableWidth, baseFontSize, "geometric", 3);
  const lineHeight = fontSize * 1.18;
  const startY = height / 2 - (lines.length * lineHeight) / 2;
  return `
  <rect width="100%" height="100%" fill="${palette.background}" />
  <rect x="0" y="0" width="${barWidth}" height="100%" fill="${palette.accent}" />
  ${lines
    .map(
      (line, i) =>
        `<text x="${width * 0.1}" y="${startY + i * lineHeight}" font-family="${FONTS.geometric}" font-weight="700" font-size="${fontSize}" fill="${palette.text}">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subheadline ? `<text x="${width * 0.1}" y="${startY + lines.length * lineHeight + fontSize * 0.6}" font-family="${FONTS.sans}" font-size="${Math.round(fontSize * 0.4)}" fill="${palette.text}" opacity="0.75">${escapeXml(subheadline.slice(0, 70))}</text>` : ""}
  <circle cx="${width * 0.1}" cy="${height * 0.92}" r="${Math.round(baseFontSize * 0.22)}" fill="${palette.accent}" />
  <text x="${width * 0.1 + baseFontSize * 0.4}" y="${height * 0.925}" font-family="${FONTS.mono}" font-weight="700" font-size="${Math.round(baseFontSize * 0.3)}" letter-spacing="2" fill="${palette.text}" opacity="0.8">${escapeXml(brandName.toUpperCase())}</text>`;
}

function splitDiagonal(ctx: TemplateContext): string {
  const { width, height, palette, headlineText, subheadline, brandName, baseFontSize } = ctx;
  const badgeR = width * 0.06;
  const availableWidth = width * 0.32; // el bloque diagonal ocupa la mitad derecha; el titular vive en la franja izquierda
  const { lines, fontSize } = fitHeadline(headlineText, availableWidth, baseFontSize * 0.85, "serif", 4);
  const lineHeight = fontSize * 1.22;
  const badgeBottom = height * 0.1 + badgeR * 2;
  const startY = Math.max(height * 0.34, badgeBottom + fontSize * 1.3);
  return `
  <rect width="100%" height="100%" fill="${palette.background}" />
  <polygon points="${width},0 ${width},${height} ${width * 0.42},${height}" fill="${palette.secondary}" opacity="0.9" />
  <circle cx="${width * 0.1 + badgeR}" cy="${height * 0.1 + badgeR}" r="${badgeR}" fill="${palette.accent}" />
  <text x="${width * 0.1 + badgeR}" y="${height * 0.1 + badgeR + fontSize * 0.18}" font-family="${FONTS.serif}" font-weight="700" font-size="${Math.round(badgeR * 1.1)}" fill="${readableTextColor(palette.accent)}" text-anchor="middle">${escapeXml(brandName.charAt(0).toUpperCase())}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="${width * 0.08}" y="${startY + i * lineHeight}" font-family="${FONTS.serif}" font-weight="700" font-size="${fontSize}" fill="${palette.text}">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subheadline ? `<text x="${width * 0.08}" y="${startY + lines.length * lineHeight + fontSize * 0.55}" font-family="${FONTS.serif}" font-style="italic" font-size="${Math.round(fontSize * 0.5)}" fill="${palette.text}" opacity="0.85">${escapeXml(subheadline.slice(0, 50))}</text>` : ""}
  <text x="${width * 0.08}" y="${height * 0.94}" font-family="${FONTS.sans}" font-weight="600" font-size="${Math.round(baseFontSize * 0.4)}" fill="${palette.text}" opacity="0.85">${escapeXml(brandName)}</text>`;
}

function radialSpotlight(ctx: TemplateContext): string {
  const { width, height, palette, headlineText, subheadline, brandName, baseFontSize } = ctx;
  const availableWidth = width * 0.84;
  const { lines, fontSize } = fitHeadline(headlineText, availableWidth, baseFontSize, "geometric", 3);
  const lineHeight = fontSize * 1.2;
  const startY = height * 0.6;
  const textColor = readableTextColor(palette.secondary);
  return `
  <defs>
    <radialGradient id="glow" cx="30%" cy="28%" r="65%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.55" />
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0" />
    </radialGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${textColor}" opacity="0.08" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="${palette.secondary}" />
  <rect width="100%" height="100%" fill="url(#dots)" />
  <rect width="100%" height="100%" fill="url(#glow)" />
  ${lines
    .map(
      (line, i) =>
        `<text x="${width * 0.08}" y="${startY + i * lineHeight}" font-family="${FONTS.geometric}" font-weight="700" font-size="${fontSize}" fill="${textColor}">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subheadline ? `<text x="${width * 0.08}" y="${startY + lines.length * lineHeight + fontSize * 0.55}" font-family="${FONTS.sans}" font-size="${Math.round(fontSize * 0.42)}" fill="${textColor}" opacity="0.8">${escapeXml(subheadline.slice(0, 70))}</text>` : ""}
  <rect x="${width * 0.08}" y="${height * 0.88}" width="${width * 0.14}" height="3" fill="${palette.accent}" />
  <text x="${width * 0.08}" y="${height * 0.94}" font-family="${FONTS.sans}" font-weight="600" font-size="${Math.round(baseFontSize * 0.4)}" fill="${textColor}" opacity="0.85">${escapeXml(brandName)}</text>`;
}

function framedMinimal(ctx: TemplateContext): string {
  const { width, height, palette, headlineText, subheadline, brandName, baseFontSize } = ctx;
  const margin = width * 0.06;
  const availableWidth = width - margin * 2 - width * 0.06;
  const { lines, fontSize } = fitHeadline(headlineText, availableWidth, baseFontSize * 0.9, "serif", 4);
  const lineHeight = fontSize * 1.25;
  const startY = height / 2 - (lines.length * lineHeight) / 2;
  return `
  <rect width="100%" height="100%" fill="${palette.background}" />
  <rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" fill="none" stroke="${palette.accent}" stroke-width="${Math.max(2, width * 0.004)}" />
  ${lines
    .map(
      (line, i) =>
        `<text x="50%" y="${startY + i * lineHeight}" font-family="${FONTS.serif}" font-weight="500" font-size="${fontSize}" fill="${palette.text}" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${subheadline ? `<text x="50%" y="${startY + lines.length * lineHeight + fontSize * 0.6}" font-family="${FONTS.serif}" font-style="italic" font-size="${Math.round(fontSize * 0.4)}" fill="${palette.text}" opacity="0.8" text-anchor="middle">${escapeXml(subheadline.slice(0, 70))}</text>` : ""}
  <circle cx="50%" cy="${height - margin * 1.7}" r="3" fill="${palette.accent}" />
  <text x="50%" y="${height - margin * 1.15}" font-family="${FONTS.mono}" font-size="${Math.round(baseFontSize * 0.3)}" letter-spacing="3" fill="${palette.text}" opacity="0.75" text-anchor="middle">${escapeXml(brandName.toUpperCase())}</text>`;
}

const TEMPLATES = [diagonalGradient, solidBlock, splitDiagonal, radialSpotlight, framedMinimal];

/**
 * Genera un placeholder visual con la identidad de marca, como SVG
 * codificado en data URI. No requiere ninguna clave externa. La interfaz
 * `ImageProvider` permite sustituirlo por un proveedor real de generación de
 * imágenes sin tocar el resto del producto (ver INTEGRATIONS.md, sección
 * "Proveedores de IA e imagen/vídeo").
 *
 * Cada llamada elige plantilla de composición y asignación de colores de
 * marca según un hash del contenido (`hashSeed`/`pick`, ver
 * src/lib/seeded-pick.ts), para que piezas distintas no salgan con el mismo
 * aspecto — antes siempre era el mismo degradado diagonal con los dos
 * primeros colores de marca, lo que hacía evidente que era una plantilla.
 * Cada plantilla ajusta también su propio tamaño de letra (`fitHeadline`)
 * para que un titular largo no se salga del lienzo.
 *
 * El hash incluye un componente aleatorio a propósito: sin él, pulsar
 * "Generar imagen con IA" dos veces sobre el mismo titular devolvía
 * exactamente la misma imagen (mismo texto + misma marca = mismo hash), así
 * que "regenerar si no gusta" no servía de nada. Un proveedor real (OpenAI,
 * fal.ai) ya es no determinista de por sí; aquí hay que simularlo.
 */
export class MockImageProvider implements ImageProvider {
  readonly id = "mock";

  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    const { width, height } = DIMENSIONS[input.aspectRatio] ?? DIMENSIONS["1:1"];
    const headlineText = input.headline ?? input.prompt;
    const seed = hashSeed(`${headlineText}-${input.brandName}-${input.aspectRatio}-${Math.random()}`);

    const palette = resolvePalette(input.brandColors, seed);
    const template = pick(TEMPLATES, seed >> 4);
    const baseFontSize = Math.round(width / 15);

    const body = template({
      width,
      height,
      palette,
      headlineText,
      subheadline: input.subheadline,
      brandName: input.brandName,
      baseFontSize,
      seed,
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}\n</svg>`;

    const base64 = Buffer.from(svg).toString("base64");
    return {
      url: `data:image/svg+xml;base64,${base64}`,
      width,
      height,
      provider: this.id,
    };
  }
}
