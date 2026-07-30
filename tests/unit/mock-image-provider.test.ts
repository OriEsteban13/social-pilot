import { describe, expect, it } from "vitest";
import { MockImageProvider, resolvePalette, readableTextColor, fitHeadline } from "@/server/media/providers/mock-image";
import type { GenerateImageInput } from "@/server/media/types";

const BRAND_COLORS = ["#1f3a2e", "#92b5a8", "#de6b3f", "#f3f1ea"]; // verde oscuro, salvia, terracota, crema

function decodeSvg(dataUri: string): string {
  const base64 = dataUri.split(",")[1];
  return Buffer.from(base64, "base64").toString("utf-8");
}

describe("readableTextColor", () => {
  it("picks white text on a dark background", () => {
    expect(readableTextColor("#1f3a2e")).toBe("#ffffff");
  });

  it("picks dark text on a light background", () => {
    expect(readableTextColor("#f3f1ea")).toBe("#161616");
  });

  it("falls back to white for an unparseable color", () => {
    expect(readableTextColor("not-a-color")).toBe("#ffffff");
  });
});

describe("resolvePalette", () => {
  it("rotates which brand color plays background/secondary/accent depending on the seed", () => {
    const p0 = resolvePalette(BRAND_COLORS, 0);
    const p1 = resolvePalette(BRAND_COLORS, 1);
    expect(p0.background).toBe(BRAND_COLORS[0]);
    expect(p1.background).toBe(BRAND_COLORS[1]);
    expect(p0.background).not.toBe(p1.background);
  });

  it("uses colors beyond the first two when there are more than two brand colors (regression: used to always use colors[0]/colors[1])", () => {
    const backgroundsSeen = new Set(Array.from({ length: BRAND_COLORS.length }, (_, seed) => resolvePalette(BRAND_COLORS, seed).background));
    expect(backgroundsSeen.size).toBe(BRAND_COLORS.length);
    for (const color of BRAND_COLORS) expect(backgroundsSeen.has(color)).toBe(true);
  });

  it("falls back to a default duo when fewer than two brand colors are given", () => {
    const palette = resolvePalette(["#123456"], 0);
    expect(palette.background).toBeTruthy();
    expect(palette.secondary).toBeTruthy();
  });

  it("sets text color based on the resolved background's actual contrast", () => {
    const palette = resolvePalette(["#f3f1ea", "#1f3a2e"], 0); // cream background this rotation
    expect(palette.text).toBe(readableTextColor(palette.background));
  });
});

describe("fitHeadline", () => {
  it("shrinks the font size for a long headline instead of overflowing the available width", () => {
    const long = "Cómo crear y optimizar encuestas y formularios efectivos para equipos de experiencia de cliente";
    const { fontSize, lines } = fitHeadline(long, 900, 100, "serif", 4);
    expect(fontSize).toBeLessThan(100);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(4);
  });

  it("keeps the base font size for a short headline that already fits", () => {
    const { fontSize, lines } = fitHeadline("Novedades", 900, 72, "sans", 3);
    expect(fontSize).toBe(72);
    expect(lines).toEqual(["Novedades"]);
  });

  it("never shrinks below the configured minimum", () => {
    const veryLong = "palabra ".repeat(60).trim();
    const { fontSize } = fitHeadline(veryLong, 200, 100, "sansBold", 2);
    expect(fontSize).toBeGreaterThanOrEqual(100 * 0.55 * 0.9); // margen por el redondeo en cada iteración
  });
});

describe("MockImageProvider.generateImage", () => {
  const provider = new MockImageProvider();
  const baseInput: GenerateImageInput = {
    prompt: "encuestas con IA",
    aspectRatio: "1:1",
    brandName: "Camaleonic Survey",
    brandColors: BRAND_COLORS,
  };

  it("returns the correct pixel dimensions for the requested aspect ratio", async () => {
    const image = await provider.generateImage({ ...baseInput, aspectRatio: "9:16" });
    expect(image.width).toBe(1080);
    expect(image.height).toBe(1920);
  });

  it("embeds the headline and brand name as readable text in the SVG", async () => {
    // Una sola palabra para que sobreviva intacta al ajuste de línea sea cual
    // sea la plantilla/anchura disponible que le toque a esta semilla.
    const image = await provider.generateImage({ ...baseInput, headline: "Retroalimentación" });
    const svg = decodeSvg(image.url);
    expect(svg).toContain("Retroalimentación");
    // Algunas plantillas muestran el nombre de marca en mayúsculas por diseño.
    expect(svg.toLowerCase()).toContain("camaleonic survey");
  });

  it("produces visually different output (template and/or palette) for different headlines — not the same template every time", async () => {
    const headlines = [
      "El futuro del feedback: encuestas conversacionales con IA",
      "5 errores habituales al diseñar una encuesta de satisfacción",
      "Cómo crear y optimizar encuestas y formularios efectivos",
      "Nueva funcionalidad: alertas automáticas ante respuestas negativas",
      "Caso de uso: cómo una cadena de retail mejoró su CSAT",
      "Lo que aprendimos en el último evento de CX",
    ];
    const svgs = await Promise.all(headlines.map((headline) => provider.generateImage({ ...baseInput, headline }).then((img) => decodeSvg(img.url))));

    // Antes, todas las imágenes usaban el mismo layout (degradado diagonal +
    // los dos mismos colores) — ahora deben variar en la plantilla elegida
    // (detectable por marcadores exclusivos de cada una) o en qué color de
    // marca ocupa el fondo.
    const backgroundFillsUsed = new Set(svgs.map((svg) => svg.match(/<rect width="100%" height="100%" fill="(url\(#\w+\)|#[0-9a-f]{6})"/i)?.[1]));
    const usesPolygon = svgs.map((svg) => svg.includes("<polygon"));
    const usesFrame = svgs.map((svg) => svg.includes('stroke="'));
    const variesInSomeWay = backgroundFillsUsed.size > 1 || new Set(usesPolygon).size > 1 || new Set(usesFrame).size > 1;
    expect(variesInSomeWay).toBe(true);
  });

  it("uses more than just the first two brand colors across many generations", async () => {
    const colorsUsed = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const image = await provider.generateImage({ ...baseInput, headline: `Titular de prueba número ${i}` });
      const svg = decodeSvg(image.url);
      for (const color of BRAND_COLORS) {
        if (svg.includes(color)) colorsUsed.add(color);
      }
    }
    expect(colorsUsed.size).toBeGreaterThan(2);
  });

  it("regenerating with the exact same input eventually produces a different image (regression: 'Regenerar imagen' used to return the identical result every time)", async () => {
    const input = { ...baseInput, headline: "El futuro del feedback: encuestas conversacionales con IA" };
    const svgs = new Set<string>();
    // Con el hash anterior (sin componente aleatorio) esto daba SIEMPRE el
    // mismo SVG — se repite varias veces para descartar que una única
    // coincidencia sea casualidad.
    for (let i = 0; i < 8; i++) {
      const image = await provider.generateImage(input);
      svgs.add(decodeSvg(image.url));
    }
    expect(svgs.size).toBeGreaterThan(1);
  });
});
