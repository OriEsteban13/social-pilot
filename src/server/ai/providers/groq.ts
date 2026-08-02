import Groq from "groq-sdk";
import { z } from "zod";
import type {
  AIProvider,
  AdjustCopyInput,
  BlogArticleDraft,
  BrandContext,
  ContentScoreResult,
  GenerateBlogArticleInput,
  GenerateIdeasInput,
  GenerateVariantInput,
  IdeaDraft,
  PerformanceInsight,
  VariantDraft,
  WebsiteAnalysisResult,
} from "../types";
import type { SocialPlatform } from "@/lib/enums";
import { PLATFORM_CHAR_LIMITS } from "@/lib/platform-limits";
import { fetchWebsiteText } from "../website-fetch";
import {
  blogArticleResponseSchema,
  contentScoreResponseSchema,
  generateIdeasResponseSchema,
  performanceInsightResponseSchema,
  variantDraftSchema,
  websiteAnalysisResponseSchema,
} from "./anthropic-schemas";
import {
  BASE_RULES,
  OPERATOR_SYSTEM_PROMPT,
  contentSystemPrompt,
  describeAdjustInstruction,
  hasMinimalBrandContext,
  mapSourceHintToType,
  renderBrandContext,
} from "./shared-prompts";
import { languageLabel } from "@/lib/languages";

/**
 * Proveedor de IA real basado en la API de Groq (inferencia rápida sobre
 * modelos open-weight de terceros — Kimi K2, GPT-OSS, Llama...). Se activa
 * con `AI_PROVIDER=groq` + `GROQ_API_KEY` — ver .env.example. Usa
 * `response_format: {type: "json_object"}` (modo JSON, no "Structured
 * Outputs") con los MISMOS esquemas Zod que AnthropicAIProvider — el JSON
 * Schema (vía `z.toJSONSchema()`, nativo de Zod 4) se incluye como
 * instrucción de texto en el prompt, y la respuesta se valida con el propio
 * esquema Zod antes de devolverla (`schema.safeParse`), en vez de depender
 * de que Groq garantice el formato del lado del servidor — ver el comentario
 * de `structuredCompletion()` para el porqué (varios modelos probados contra
 * una cuenta real no soportaban `json_schema` o no estaban disponibles).
 *
 * Modelo por defecto: `llama-3.3-70b-versatile` — modelo de propósito
 * general de Groq, disponible por defecto en cualquier cuenta. Se probó
 * primero `moonshotai/kimi-k2-instruct-0905` (404, no disponible en la
 * cuenta) — `GROQ_MODEL` permite cambiarlo si se necesita otro (comprobar el
 * catálogo vigente en
 * console.groq.com/docs/models antes de cambiarlo).
 *
 * Nota de calidad: al ser modelos open-weight de terceros (no Claude), la
 * redacción/matiz de marca y la fidelidad de traducción entre idiomas puede
 * ser algo inferior — recomendable revisar el contenido generado con más
 * atención que con AI_PROVIDER=anthropic, especialmente al principio.
 *
 * Igual que AnthropicAIProvider: nunca hace fallback silencioso a
 * MockAIProvider si la llamada falla — el error se propaga tal cual.
 */

function getModel(): string {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada. Define AI_PROVIDER=mock, o añade la clave para usar AI_PROVIDER=groq.");
  }
  return new Groq({ apiKey });
}

async function withErrorHandling<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Groq.AuthenticationError) {
      throw new Error(`Groq (${action}): clave de API inválida. Revisa GROQ_API_KEY.`);
    }
    if (error instanceof Groq.RateLimitError) {
      throw new Error(`Groq (${action}): límite de peticiones alcanzado. Reinténtalo en unos segundos.`);
    }
    if (error instanceof Groq.APIError) {
      throw new Error(`Groq (${action}): error de la API (${error.status}) — ${error.message}`);
    }
    throw error;
  }
}

/**
 * Pide una respuesta JSON ajustada a `schema` y la valida con el propio
 * esquema Zod antes de devolverla.
 *
 * Usa `response_format: {type: "json_object"}` (modo JSON "clásico",
 * soportado por prácticamente cualquier modelo de Groq) en vez de
 * `json_schema` (Structured Outputs): probado contra una cuenta real, dos
 * modelos distintos fallaron con `json_schema` — `moonshotai/kimi-k2-
 * instruct-0905` con 404 (no disponible en la cuenta) y
 * `llama-3.3-70b-versatile` con 400 "this model does not support response
 * format json_schema". El subconjunto de modelos que sí soportan
 * `json_schema` es estrecho y varía por cuenta, así que depender de él es
 * frágil. En su lugar, el JSON Schema de `schema` se describe dentro del
 * propio prompt (instrucción explícita del formato esperado) y la respuesta
 * se valida igualmente con `schema.parse(...)` después — si el modelo no
 * cumple el formato, se detecta aquí con un error claro en vez de guardar
 * datos corruptos, en vez de confiar ciegamente en una garantía del lado de
 * Groq que ha demostrado no ser fiable en todos los modelos/cuentas.
 */
async function structuredCompletion<T extends z.ZodTypeAny>(
  client: Groq,
  schema: T,
  schemaName: string,
  params: { system: string; user: string; max_tokens: number }
): Promise<z.infer<T>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const response = await client.chat.completions.create({
    model: getModel(),
    max_tokens: params.max_tokens,
    messages: [
      {
        role: "system",
        content: `${params.system}\n\nResponde ÚNICAMENTE con un objeto JSON válido (sin explicaciones, sin bloques de código markdown) que cumpla exactamente este JSON Schema:\n${jsonSchema}`,
      },
      { role: "user", content: params.user },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`Groq no devolvió contenido para "${schemaName}".`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Groq devolvió un JSON inválido para "${schemaName}": ${content.slice(0, 200)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Groq devolvió un JSON con un formato inesperado para "${schemaName}": ${result.error.message}`);
  }
  return result.data;
}

export class GroqAIProvider implements AIProvider {
  readonly id = "groq";

  async generateIdeas(input: GenerateIdeasInput): Promise<IdeaDraft[]> {
    const { brand, count, sourceHint, goals, excludeTitles = [], contentKind = "SOCIAL_POST" } = input;
    const isBlog = contentKind === "BLOG_ARTICLE";

    return withErrorHandling("generateIdeas", async () => {
      const client = getClient();
      const basePrompt = [
        isBlog
          ? `Genera exactamente ${count} ideas de TEMAS PARA ARTÍCULOS DE BLOG (contenido largo para la web de la empresa, no publicaciones de redes sociales) para esta empresa:`
          : `Genera exactamente ${count} ideas de contenido para redes sociales para esta empresa:`,
        renderBrandContext(brand),
        sourceHint ? `Origen/inspiración solicitada: ${sourceHint}.` : null,
        goals?.length ? `Objetivos de negocio a priorizar: ${goals.join(", ")}.` : null,
        excludeTitles.length
          ? `No repitas (ni parafrasees de forma obvia) estos títulos ya usados: ${excludeTitles.slice(-40).join(" | ")}.`
          : null,
        isBlog
          ? "Cada idea debe indicar el pilar de contenido al que pertenece (usa el nombre exacto de uno de los pilares dados si existen), prioridad, justificación (rationale) y una llamada a la acción (cta). NO incluyas recommendedPlatform ni recommendedFormat — un artículo de blog no tiene red social ni formato."
          : "Cada idea debe indicar la red social y el formato más adecuados, el pilar de contenido al que pertenece (usa el nombre exacto de uno de los pilares dados si existen), prioridad, justificación (rationale) y una llamada a la acción (cta).",
        `IMPORTANTE: el array "ideas" de tu respuesta debe contener EXACTAMENTE ${count} elementos completos — ni uno más, ni uno menos.`,
      ]
        .filter(Boolean)
        .join("\n\n");

      let parsed = await structuredCompletion(client, generateIdeasResponseSchema, "generate_ideas", {
        system: contentSystemPrompt(brand, ""),
        max_tokens: 4096,
        user: basePrompt,
      });

      // Un modelo en modo json_object (sin garantía de esquema estricta) a
      // veces no respeta la cantidad exacta pedida a la primera — se
      // reintenta una vez con un recordatorio explícito antes de conformarse
      // con menos ideas de las pedidas.
      if (parsed.ideas.length < count) {
        parsed = await structuredCompletion(client, generateIdeasResponseSchema, "generate_ideas", {
          system: contentSystemPrompt(brand, ""),
          max_tokens: 4096,
          user: `${basePrompt}\n\nTu respuesta anterior solo tenía ${parsed.ideas.length} ideas en vez de ${count}. Genera ${count} ideas completas y distintas entre sí.`,
        });
      }

      const forcedValidation = !hasMinimalBrandContext(brand);
      return parsed.ideas.map((idea) => ({
        ...idea,
        recommendedPlatform: isBlog ? undefined : idea.recommendedPlatform,
        recommendedFormat: isBlog ? undefined : idea.recommendedFormat,
        sourceType: sourceHint ? mapSourceHintToType(sourceHint) : "MANUAL",
        needsValidation: idea.needsValidation || forcedValidation,
        contentKind,
        // Igual que Claude (y a diferencia del mock), se asume traducción
        // real: el idioma "real" coincide siempre con el pedido.
        effectiveLanguage: brand.language,
      }));
    });
  }

  async generateVariant(input: GenerateVariantInput): Promise<VariantDraft> {
    const { brand, platform, format, brief, campaignGoal } = input;
    const limit = PLATFORM_CHAR_LIMITS[platform];

    return withErrorHandling("generateVariant", async () => {
      const client = getClient();
      const draft = await structuredCompletion(client, variantDraftSchema, "variant_draft", {
        system: contentSystemPrompt(brand, ""),
        max_tokens: 2048,
        user: [
          `Escribe una publicación para ${platform} (formato ${format}) a partir de este briefing: "${brief}".`,
          renderBrandContext(brand),
          campaignGoal ? `Objetivo de esta pieza: ${campaignGoal}.` : null,
          `El texto (body) debe respetar un máximo de ${limit} caracteres, adaptado a las convenciones de ${platform} (hook inicial, tono, longitud típica).`,
          format === "VIDEO"
            ? "Al ser un vídeo corto, incluye también scriptScenes: una lista de 3-5 escenas con screenText, voiceover y durationSeconds."
            : "No incluyas scriptScenes para este formato.",
          "Incluye hashtags relevantes (sin el símbolo # duplicado), una cta y, si el formato lleva imagen, un altText descriptivo.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      const body = draft.body.length > limit ? `${draft.body.slice(0, limit - 1).trimEnd()}…` : draft.body;

      return {
        ...draft,
        body,
        charCount: body.length,
        needsValidation: draft.needsValidation || !hasMinimalBrandContext(brand),
      };
    });
  }

  async generateBlogArticle(input: GenerateBlogArticleInput): Promise<BlogArticleDraft> {
    const { brand, brief, pillarName, targetWordCount = 800 } = input;

    return withErrorHandling("generateBlogArticle", async () => {
      const client = getClient();
      const draft = await structuredCompletion(client, blogArticleResponseSchema, "blog_article", {
        system: contentSystemPrompt(brand, ""),
        max_tokens: 8192,
        user: [
          `Escribe un artículo de blog para la web de esta empresa a partir de este briefing: "${brief}".`,
          renderBrandContext(brand),
          pillarName ? `Pilar de contenido al que pertenece: ${pillarName}.` : null,
          `Extensión objetivo: unas ${targetWordCount} palabras. Estructura el cuerpo (body) en párrafos claros separados por saltos de línea dobles; puedes usar subtítulos con "## " si ayuda a la legibilidad.`,
          "Optimizado para lectura web y SEO básico: metaDescription de máximo 155 caracteres, 3-5 tags relevantes, y una llamada a la acción (cta) al final del artículo.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      return {
        ...draft,
        needsValidation: draft.needsValidation || !hasMinimalBrandContext(brand),
      };
    });
  }

  async adjustCopy(input: AdjustCopyInput): Promise<string> {
    const { body, instruction, targetTone, targetLanguage, platform, language } = input;
    const limit = PLATFORM_CHAR_LIMITS[platform];
    const instructionText = describeAdjustInstruction(instruction, targetTone, targetLanguage);

    return withErrorHandling("adjustCopy", async () => {
      const client = getClient();
      const response = await client.chat.completions.create({
        model: getModel(),
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `${BASE_RULES}\n- El texto original está en ${languageLabel(language)}. Mantén ese idioma salvo que la instrucción pida explícitamente traducirlo.\nDevuelve ÚNICAMENTE el texto final, sin explicaciones ni comillas envolventes.`,
          },
          {
            role: "user",
            content: `Texto original (${platform}, máx. ${limit} caracteres):\n${body}\n\nInstrucción: ${instructionText}`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content ?? body;
      return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text.trim();
    });
  }

  async scoreContent(body: string, platform: SocialPlatform, brand: BrandContext): Promise<ContentScoreResult> {
    return withErrorHandling("scoreContent", async () => {
      const client = getClient();
      return structuredCompletion(client, contentScoreResponseSchema, "content_score", {
        system: OPERATOR_SYSTEM_PROMPT,
        max_tokens: 1536,
        user: [
          `Evalúa este contenido para ${platform} (límite ${PLATFORM_CHAR_LIMITS[platform]} caracteres) con un Content Score de 0 a 100 y un desglose de 0 a 100 en: hook, clarity, platformFit, brandConsistency, engagementPotential, cta, length, originality.`,
          renderBrandContext(brand),
          `Contenido a evaluar:\n"""\n${body}\n"""`,
          "Da entre 1 y 4 recomendaciones concretas y accionables para mejorar la puntuación.",
        ].join("\n\n"),
      });
    });
  }

  async analyzeWebsite(url: string, rawText?: string): Promise<WebsiteAnalysisResult> {
    const text = rawText ?? (await fetchWebsiteText(url));

    if (!text) {
      return {
        summary: `No se ha podido leer contenido de ${url}. Completa el Brand Brain manualmente o vuelve a intentar el análisis.`,
        detectedServices: [],
        keyMessages: [],
        detectedTone: "CERCANO",
        suggestedPillars: [],
        needsValidation: true,
      };
    }

    return withErrorHandling("analyzeWebsite", async () => {
      const client = getClient();
      return structuredCompletion(client, websiteAnalysisResponseSchema, "website_analysis", {
        system: OPERATOR_SYSTEM_PROMPT,
        max_tokens: 2048,
        user: [
          `Analiza el siguiente texto extraído de la web ${url} y construye la base del Brand Brain de esta empresa.`,
          "Identifica: un resumen breve, los servicios/productos detectados, los mensajes clave, el tono de comunicación predominante, y de 3 a 5 pilares de contenido sugeridos (nombre + descripción).",
          "Basa todo exclusivamente en el texto proporcionado; no inventes servicios que no aparezcan.",
          `Texto de la web:\n"""\n${text}\n"""`,
        ].join("\n\n"),
      });
    });
  }

  async summarizePerformance(metricsSummary: Record<string, unknown>): Promise<PerformanceInsight> {
    const hasData = Object.keys(metricsSummary).length > 0;
    if (!hasData) {
      return {
        summary: "Todavía no hay suficientes publicaciones con métricas para generar un análisis fiable.",
        topPerformers: [],
        underperformers: [],
        recommendations: ["Publica de forma constante durante 2-3 semanas para empezar a obtener recomendaciones fiables."],
      };
    }

    return withErrorHandling("summarizePerformance", async () => {
      const client = getClient();
      return structuredCompletion(client, performanceInsightResponseSchema, "performance_insight", {
        system: OPERATOR_SYSTEM_PROMPT,
        max_tokens: 2048,
        user: [
          "Analiza este resumen de métricas de redes sociales (JSON) y redacta un análisis de rendimiento en español, orientado a acción.",
          "Basa las recomendaciones únicamente en los datos proporcionados; si un dato no está presente (p.ej. mejor horario), omítelo en vez de inventarlo.",
          `Métricas:\n${JSON.stringify(metricsSummary, null, 2)}`,
        ].join("\n\n"),
      });
    });
  }
}
