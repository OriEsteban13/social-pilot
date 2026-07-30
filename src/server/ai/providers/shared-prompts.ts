import type { AdjustCopyInput, BrandContext } from "../types";
import { languageLabel } from "@/lib/languages";

/**
 * Reglas de sistema y helpers de prompt compartidos por cualquier proveedor
 * de IA real basado en un LLM (Anthropic, Groq...). Se extraen aquí para que
 * todos los proveedores redacten con las mismas reglas de marca/idioma sin
 * duplicar el texto — si cambian, cambian para todos los proveedores reales
 * a la vez.
 */

export const BASE_RULES = `Eres el redactor y estratega de contenidos de "Camaleonic Social Pilot", un copiloto de IA para marketing en redes sociales.

Reglas estrictas:
- Usa ÚNICAMENTE la información de marca que se te proporciona (descripción, propuesta de valor, diferenciadores, claims, audiencias). No inventes cifras, clientes, resultados ni afirmaciones que no estén en el contexto dado.
- Si el contexto de marca es insuficiente para producir contenido específico y fiable, indícalo marcando needsValidation en true — no rellenes con datos genéricos disfrazados de específicos.
- Nunca uses las palabras marcadas como prohibidas en el Brand Brain.
- Responde siempre con el formato estructurado solicitado.`;

/**
 * El sistema tiene dos "idiomas" independientes: el idioma de PUBLICACIÓN
 * (el que elige cada empresa en el Dashboard — `brand.language` — para el
 * contenido que se va a publicar de verdad) y el idioma de la propia
 * interfaz de la app (siempre español, para el equipo que la opera). Las
 * funciones que redactan contenido publicable (ideas, copys) usan el
 * primero; las que generan explicaciones o análisis para el equipo interno
 * (Content Score, Brand Brain, Analítica) usan el segundo.
 */
export function contentSystemPrompt(brand: BrandContext, extra: string): string {
  return `${BASE_RULES}\n- Escribe todo el contenido solicitado en ${languageLabel(brand.language)}.\n${extra}`;
}

export const OPERATOR_SYSTEM_PROMPT = `${BASE_RULES}\n- Responde siempre en español, independientemente del idioma del contenido que estés analizando: esta respuesta la lee el equipo que opera la aplicación, no el público final.`;

export function renderBrandContext(brand: BrandContext): string {
  const lines = [
    `Empresa: ${brand.workspaceName}`,
    brand.industry ? `Sector: ${brand.industry}` : null,
    brand.website ? `Web: ${brand.website}` : null,
    `Idioma de publicación: ${languageLabel(brand.language)}`,
    brand.description ? `Descripción: ${brand.description}` : null,
    brand.valueProposition ? `Propuesta de valor: ${brand.valueProposition}` : null,
    `Tono: ${brand.toneCustom || brand.tone}`,
    brand.targetAudiences.length ? `Audiencias objetivo: ${brand.targetAudiences.join(", ")}` : null,
    brand.differentiators.length ? `Diferenciadores: ${brand.differentiators.join(", ")}` : null,
    brand.claims.length ? `Claims permitidos: ${brand.claims.join(", ")}` : null,
    brand.allowedTerms.length ? `Palabras a usar: ${brand.allowedTerms.join(", ")}` : null,
    brand.forbiddenTerms.length ? `Palabras PROHIBIDAS: ${brand.forbiddenTerms.join(", ")}` : null,
    brand.pillars.length
      ? `Pilares de contenido: ${brand.pillars.map((p) => `${p.name}${p.description ? ` (${p.description})` : ""}`).join("; ")}`
      : "Pilares de contenido: ninguno definido todavía.",
  ].filter(Boolean);
  return lines.join("\n");
}

export function hasMinimalBrandContext(brand: BrandContext): boolean {
  return Boolean(brand.description || brand.valueProposition) && brand.pillars.length > 0;
}

export function describeAdjustInstruction(instruction: AdjustCopyInput["instruction"], targetTone?: string, targetLanguage?: string): string {
  switch (instruction) {
    case "SHORTEN":
      return "Acorta el texto manteniendo el mensaje principal y el CTA.";
    case "LENGTHEN":
      return "Alarga el texto añadiendo contexto o detalle relevante, sin inventar datos nuevos.";
    case "MORE_COMMERCIAL":
      return "Hazlo más comercial, orientado a conversión, sin sonar agresivo.";
    case "MORE_EDUCATIONAL":
      return "Hazlo más educativo, aportando valor informativo antes de cualquier CTA.";
    case "ADD_EMOJIS":
      return "Añade emojis relevantes con moderación, sin saturar el texto.";
    case "REMOVE_EMOJIS":
      return "Elimina todos los emojis del texto.";
    case "CHANGE_TONE":
      return `Reescribe el texto con un tono ${targetTone ?? "más cercano"}.`;
    case "PROOFREAD":
      return "Corrige gramática, ortografía y puntuación sin cambiar el mensaje.";
    case "ADD_CTA":
      return "Añade o refuerza una llamada a la acción clara al final.";
    case "TRANSLATE":
      return `Traduce el texto a ${targetLanguage ?? "inglés"}, manteniendo el tono y el CTA.`;
  }
}

export function mapSourceHintToType(hint: string): string {
  const h = hint.toLowerCase();
  if (h.includes("web")) return "WEBSITE";
  if (h.includes("doc")) return "DOCUMENT";
  if (h.includes("noticia") || h.includes("news")) return "NEWS";
  if (h.includes("rendimiento") || h.includes("performance")) return "PERFORMANCE";
  if (h.includes("evento")) return "EVENT";
  if (h.includes("caso") || h.includes("success")) return "SUCCESS_CASE";
  if (h.includes("faq")) return "FAQ";
  return "MANUAL";
}
