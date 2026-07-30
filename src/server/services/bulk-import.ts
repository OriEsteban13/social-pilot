import * as XLSX from "xlsx";
import { prisma } from "@/server/db/client";
import { logAudit } from "./audit";
import { SOCIAL_PLATFORMS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

/**
 * Importación masiva de ideas desde un CSV/Excel subido por el usuario — un
 * atajo a "Generar ideas" para cuando ya tiene sus propios títulos escritos
 * (p.ej. un calendario editorial hecho en una reunión) en vez de pedirle a la
 * IA que los invente. Las filas se guardan como ContentIdea en estado SAVED
 * (ya curadas por una persona) para que aparezcan listas para "Convertir" en
 * la pestaña "Guardadas" de Ideas — no se llama a la IA en este paso.
 */

const TEMPLATE_HEADERS = ["titulo", "descripcion", "tipo", "plataforma", "idioma", "pilar", "prioridad"] as const;

const VALID_LANGUAGE_CODES: Set<string> = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

const PRIORITY_BY_LABEL: Record<string, string> = {
  alta: "HIGH",
  high: "HIGH",
  media: "MEDIUM",
  medium: "MEDIUM",
  baja: "LOW",
  low: "LOW",
};

const PLATFORM_BY_LABEL: Record<string, SocialPlatform> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.toLowerCase(), p])
) as Record<string, SocialPlatform>;

export interface ParsedIdeaRow {
  rowNumber: number; // 1-based, tal como lo vería el usuario en el fichero (excluyendo cabecera)
  title: string;
  description: string;
  contentKind: "SOCIAL_POST" | "BLOG_ARTICLE";
  recommendedPlatform: SocialPlatform | null;
  pillarName: string | null;
  priority: string;
  language: string | null; // código de SUPPORTED_LANGUAGES; null = idioma por defecto del workspace
}

export interface ParseResult {
  rows: ParsedIdeaRow[];
  errors: string[];
}

function cell(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  return raw === undefined || raw === null ? "" : String(raw).trim();
}

// Firmas de los formatos binarios reales que SheetJS sabe decodificar
// directamente desde bytes: zip (xlsx/xlsm/ods, "PK\x03\x04") y OLE2 (xls
// antiguo). Cualquier otra cosa se trata como texto CSV — si se le pasa un
// Buffer que no es ninguno de los dos, SheetJS lo interpreta como "binary
// string" (cada byte = un carácter Latin-1), lo que corrompe cualquier CSV en
// UTF-8 con tildes/eñes (p.ej. "título" → "tÃ­tulo"). Decodificar nosotros
// mismos el Buffer como UTF-8 y pasarle el string evita ese mojibake.
function looksLikeBinarySpreadsheet(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  return isZip || isOle;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseIdeasWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const errors: string[] = [];
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let workbook: XLSX.WorkBook;
  try {
    workbook = looksLikeBinarySpreadsheet(nodeBuffer)
      ? XLSX.read(nodeBuffer, { type: "buffer" })
      : XLSX.read(stripBom(nodeBuffer.toString("utf-8")), { type: "string" });
  } catch {
    return { rows: [], errors: ["No se ha podido leer el archivo. Comprueba que sea un .csv o .xlsx válido."] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["El archivo no contiene ninguna hoja."] };

  const sheet = workbook.Sheets[sheetName];
  // defval:"" evita que las celdas vacías desaparezcan del objeto (romperían el acceso por clave).
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (raw.length === 0) {
    return { rows: [], errors: ["El archivo no tiene filas de datos (solo cabecera o está vacío)."] };
  }
  if (raw.length > 200) {
    return { rows: [], errors: ["Máximo 200 filas por importación. Divide el archivo en lotes más pequeños."] };
  }

  const rows: ParsedIdeaRow[] = [];

  raw.forEach((r, index) => {
    const rowNumber = index + 1;
    const title = cell(r, "titulo") || cell(r, "título");
    if (!title) {
      errors.push(`Fila ${rowNumber}: falta "titulo", se ha omitido.`);
      return;
    }

    const description = cell(r, "descripcion") || cell(r, "descripción") || title;

    const tipoRaw = cell(r, "tipo").toLowerCase();
    let contentKind: ParsedIdeaRow["contentKind"] = "SOCIAL_POST";
    if (tipoRaw === "blog") contentKind = "BLOG_ARTICLE";
    else if (tipoRaw && tipoRaw !== "post") {
      errors.push(`Fila ${rowNumber}: "tipo" = "${tipoRaw}" no reconocido (usa "post" o "blog"), se ha asumido "post".`);
    }

    const plataformaRaw = cell(r, "plataforma").toLowerCase();
    let recommendedPlatform: SocialPlatform | null = null;
    if (plataformaRaw && contentKind === "SOCIAL_POST") {
      recommendedPlatform = PLATFORM_BY_LABEL[plataformaRaw] ?? null;
      if (!recommendedPlatform) {
        errors.push(
          `Fila ${rowNumber}: "plataforma" = "${plataformaRaw}" no reconocida (usa linkedin, instagram, tiktok, threads o x), se ha dejado sin plataforma sugerida.`
        );
      }
    }

    const pillarName = cell(r, "pilar") || null;

    const prioridadRaw = cell(r, "prioridad").toLowerCase();
    const priority = prioridadRaw ? (PRIORITY_BY_LABEL[prioridadRaw] ?? "MEDIUM") : "MEDIUM";
    if (prioridadRaw && !PRIORITY_BY_LABEL[prioridadRaw]) {
      errors.push(`Fila ${rowNumber}: "prioridad" = "${prioridadRaw}" no reconocida (usa alta, media o baja), se ha asumido "media".`);
    }

    const idiomaRaw = cell(r, "idioma").toLowerCase();
    let language: string | null = null;
    if (idiomaRaw) {
      if (VALID_LANGUAGE_CODES.has(idiomaRaw)) {
        language = idiomaRaw;
      } else {
        errors.push(
          `Fila ${rowNumber}: "idioma" = "${idiomaRaw}" no reconocido (usa ${[...VALID_LANGUAGE_CODES].join(", ")}), se ha dejado el idioma por defecto del workspace.`
        );
      }
    }

    rows.push({ rowNumber, title, description, contentKind, recommendedPlatform, pillarName, priority, language });
  });

  return { rows, errors };
}

export async function importIdeasFromRows(workspaceId: string, rows: ParsedIdeaRow[]) {
  if (rows.length === 0) return { created: 0 };

  const pillars = await prisma.contentPillar.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const pillarIdByName = new Map(pillars.map((p) => [p.name.toLowerCase(), p.id]));

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.contentIdea.create({
        data: {
          workspaceId,
          title: row.title,
          description: row.description,
          contentKind: row.contentKind,
          recommendedPlatform: row.recommendedPlatform,
          priority: row.priority,
          language: row.language,
          status: "SAVED",
          sourceType: "MANUAL",
          pillarId: row.pillarName ? (pillarIdByName.get(row.pillarName.toLowerCase()) ?? undefined) : undefined,
        },
      })
    )
  );

  await logAudit({
    workspaceId,
    action: "ideas.imported",
    entityType: "ContentIdea",
    metadata: { count: created.length },
  });

  return { created: created.length };
}

export function buildImportTemplateWorkbook(pillarNames: string[]): Buffer {
  const exampleRows = [
    {
      titulo: "3 señales de que tu encuesta de satisfacción necesita un rediseño",
      descripcion: "Post educativo con ejemplos reales de preguntas mal formuladas y cómo corregirlas.",
      tipo: "post",
      plataforma: "linkedin",
      idioma: "es",
      pilar: pillarNames[0] ?? "",
      prioridad: "media",
    },
    {
      titulo: "How to choose the right survey tool for your CX team",
      descripcion: "Blog article comparing key criteria: personalization, real-time dashboards and support.",
      tipo: "blog",
      plataforma: "",
      idioma: "en",
      pilar: "",
      prioridad: "alta",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(exampleRows, { header: [...TEMPLATE_HEADERS] });
  sheet["!cols"] = [{ wch: 55 }, { wch: 60 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }];

  const languageCodes = SUPPORTED_LANGUAGES.map((l) => l.code).join(", ");
  const instructions = [
    { columna: "titulo", obligatorio: "Sí", descripcion: "Título breve de la idea (se usará como título del post/artículo)." },
    { columna: "descripcion", obligatorio: "No", descripcion: "Detalle adicional. Si se deja vacío, se usa el título." },
    { columna: "tipo", obligatorio: "No", descripcion: 'Valores admitidos: "post" (red social, por defecto) o "blog" (artículo de blog).' },
    { columna: "plataforma", obligatorio: "No", descripcion: "Solo si tipo=post. Valores: linkedin, instagram, tiktok, threads, x. Es solo una sugerencia inicial, se puede cambiar después." },
    { columna: "idioma", obligatorio: "No", descripcion: `Idioma en el que se redactará esta publicación al generarla. Valores: ${languageCodes}. Si se deja vacío, se usa el idioma por defecto del workspace.` },
    { columna: "pilar", obligatorio: "No", descripcion: pillarNames.length ? `Debe coincidir con el nombre de un pilar existente: ${pillarNames.join(", ")}.` : "Nombre de un pilar de contenido ya creado en Brand Brain (opcional)." },
    { columna: "prioridad", obligatorio: "No", descripcion: 'Valores: alta, media (por defecto) o baja.' },
    { columna: "", obligatorio: "", descripcion: "" },
    { columna: "Nota", obligatorio: "", descripcion: 'Cada fila se importa como una idea en estado "Guardada", lista para revisar y convertir en la sección Ideas. No se genera contenido con IA automáticamente; el idioma se aplicará cuando generes esa publicación.' },
  ];
  const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
  instructionsSheet["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ideas");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
