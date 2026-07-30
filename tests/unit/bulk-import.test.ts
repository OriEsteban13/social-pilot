import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseIdeasWorkbook, buildImportTemplateWorkbook } from "@/server/services/bulk-import";

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, "utf-8");
}

function xlsxBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ideas");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseIdeasWorkbook", () => {
  it("parses a plain CSV buffer into idea rows with sensible defaults", () => {
    const buffer = csvBuffer("titulo,descripcion,tipo,plataforma,pilar,prioridad\nMi primer post,Detalle,post,linkedin,,alta\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Mi primer post",
      description: "Detalle",
      contentKind: "SOCIAL_POST",
      recommendedPlatform: "LINKEDIN",
      priority: "HIGH",
    });
  });

  it("parses an .xlsx buffer the same way as CSV", () => {
    const buffer = xlsxBuffer([{ titulo: "Idea en excel", descripcion: "", tipo: "", plataforma: "", pilar: "", prioridad: "" }]);
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Idea en excel");
  });

  it("defaults missing descripcion to the title and missing tipo/prioridad to post/media", () => {
    const buffer = csvBuffer("titulo\nSolo título\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      title: "Solo título",
      description: "Solo título",
      contentKind: "SOCIAL_POST",
      priority: "MEDIUM",
      recommendedPlatform: null,
    });
  });

  it("skips rows without a título and reports why", () => {
    const buffer = csvBuffer("titulo,descripcion\n,Sin título\nCon título,Bien\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Con título");
    expect(errors.some((e) => e.includes("Fila 1") && e.includes("titulo"))).toBe(true);
  });

  it("maps tipo=blog to BLOG_ARTICLE and ignores plataforma for blog rows", () => {
    const buffer = csvBuffer("titulo,tipo,plataforma\nArtículo de blog,blog,instagram\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows[0].contentKind).toBe("BLOG_ARTICLE");
    expect(rows[0].recommendedPlatform).toBeNull();
  });

  it("falls back to defaults and warns on unrecognized tipo/plataforma/prioridad values", () => {
    const buffer = csvBuffer("titulo,tipo,plataforma,prioridad\nIdea rara,facebook-post,myspace,urgente\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].contentKind).toBe("SOCIAL_POST");
    expect(rows[0].recommendedPlatform).toBeNull();
    expect(rows[0].priority).toBe("MEDIUM");
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("parses a valid idioma column into the ContentIdea language override", () => {
    const buffer = csvBuffer("titulo,idioma\nPost en inglés,en\nPost en francés,FR\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows[0].language).toBe("en");
    expect(rows[1].language).toBe("fr"); // insensible a mayúsculas
  });

  it("defaults idioma to null (idioma por defecto del workspace) when omitted", () => {
    const buffer = csvBuffer("titulo\nSin idioma indicado\n");
    const { rows } = parseIdeasWorkbook(buffer);
    expect(rows[0].language).toBeNull();
  });

  it("falls back to null and warns on an unrecognized idioma value", () => {
    const buffer = csvBuffer("titulo,idioma\nIdioma inventado,klingon\n");
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(rows[0].language).toBeNull();
    expect(errors.some((e) => e.includes("idioma") && e.includes("klingon"))).toBe(true);
  });

  it("rejects files with more than 200 rows", () => {
    const lines = Array.from({ length: 201 }, (_, i) => `Idea ${i}`).join("\n");
    const buffer = csvBuffer(`titulo\n${lines}\n`);
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("200 filas");
  });

  it("reports a friendly error instead of throwing on a corrupt/unreadable file", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("buildImportTemplateWorkbook", () => {
  it("produces a workbook whose own example rows parse back without errors", () => {
    const buffer = buildImportTemplateWorkbook(["Producto", "Cultura"]);
    const { rows, errors } = parseIdeasWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.contentKind === "BLOG_ARTICLE")).toBe(true);
    expect(rows.some((r) => r.recommendedPlatform === "LINKEDIN")).toBe(true);
    expect(rows.some((r) => r.language === "es")).toBe(true);
    expect(rows.some((r) => r.language === "en")).toBe(true);
  });

  it("includes a second sheet with instructions", () => {
    const buffer = buildImportTemplateWorkbook([]);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Instrucciones");
  });
});
