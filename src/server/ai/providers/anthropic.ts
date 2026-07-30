import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
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
 * Proveedor de IA real basado en la API de Claude (Anthropic). Se activa con
 * `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` — ver .env.example. Usa
 * `client.messages.parse()` con `output_config.format` (structured outputs
 * validados con Zod) para obtener JSON fiable en cada función, salvo
 * `adjustCopy`, que devuelve texto plano. Las reglas de marca/idioma
 * compartidas con otros proveedores reales viven en `shared-prompts.ts`.
 *
 * Nunca hace fallback silencioso a MockAIProvider si la llamada falla: un
 * error de la API (clave inválida, rate limit...) se propaga tal cual, para
 * que quede visible en vez de degradarse a contenido de plantilla sin que
 * nadie se entere.
 */

function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada. Define AI_PROVIDER=mock, o añade la clave para usar AI_PROVIDER=anthropic."
    );
  }
  return new Anthropic({ apiKey });
}

async function withErrorHandling<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(`Claude (${action}): clave de API inválida. Revisa ANTHROPIC_API_KEY.`);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(`Claude (${action}): límite de peticiones alcanzado. Reinténtalo en unos segundos.`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude (${action}): error de la API (${error.status}) — ${error.message}`);
    }
    throw error;
  }
}

export class AnthropicAIProvider implements AIProvider {
  readonly id = "anthropic";

  async generateIdeas(input: GenerateIdeasInput): Promise<IdeaDraft[]> {
    const { brand, count, sourceHint, goals, excludeTitles = [], contentKind = "SOCIAL_POST" } = input;
    const isBlog = contentKind === "BLOG_ARTICLE";

    return withErrorHandling("generateIdeas", async () => {
      const client = getClient();
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 4096,
        system: contentSystemPrompt(brand, ""),
        messages: [
          {
            role: "user",
            content: [
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
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        output_config: { format: zodOutputFormat(generateIdeasResponseSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió ideas en el formato esperado.");
      }

      const forcedValidation = !hasMinimalBrandContext(brand);
      return response.parsed_output.ideas.map((idea) => ({
        ...idea,
        recommendedPlatform: isBlog ? undefined : idea.recommendedPlatform,
        recommendedFormat: isBlog ? undefined : idea.recommendedFormat,
        sourceType: sourceHint ? mapSourceHintToType(sourceHint) : "MANUAL",
        needsValidation: idea.needsValidation || forcedValidation,
        contentKind,
        // A diferencia del mock, Claude sí traduce de verdad — siempre
        // redacta en el idioma pedido, así que el idioma "real" coincide
        // siempre con el pedido.
        effectiveLanguage: brand.language,
      }));
    });
  }

  async generateVariant(input: GenerateVariantInput): Promise<VariantDraft> {
    const { brand, platform, format, brief, campaignGoal } = input;
    const limit = PLATFORM_CHAR_LIMITS[platform];

    return withErrorHandling("generateVariant", async () => {
      const client = getClient();
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 2048,
        system: contentSystemPrompt(brand, ""),
        messages: [
          {
            role: "user",
            content: [
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
          },
        ],
        output_config: { format: zodOutputFormat(variantDraftSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió el contenido en el formato esperado.");
      }

      const draft = response.parsed_output;
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
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 8192,
        system: contentSystemPrompt(brand, ""),
        messages: [
          {
            role: "user",
            content: [
              `Escribe un artículo de blog para la web de esta empresa a partir de este briefing: "${brief}".`,
              renderBrandContext(brand),
              pillarName ? `Pilar de contenido al que pertenece: ${pillarName}.` : null,
              `Extensión objetivo: unas ${targetWordCount} palabras. Estructura el cuerpo (body) en párrafos claros separados por saltos de línea dobles; puedes usar subtítulos con "## " si ayuda a la legibilidad.`,
              "Optimizado para lectura web y SEO básico: metaDescription de máximo 155 caracteres, 3-5 tags relevantes, y una llamada a la acción (cta) al final del artículo.",
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        output_config: { format: zodOutputFormat(blogArticleResponseSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió el artículo en el formato esperado.");
      }

      return {
        ...response.parsed_output,
        needsValidation: response.parsed_output.needsValidation || !hasMinimalBrandContext(brand),
      };
    });
  }

  async adjustCopy(input: AdjustCopyInput): Promise<string> {
    const { body, instruction, targetTone, targetLanguage, platform, language } = input;
    const limit = PLATFORM_CHAR_LIMITS[platform];
    const instructionText = describeAdjustInstruction(instruction, targetTone, targetLanguage);

    return withErrorHandling("adjustCopy", async () => {
      const client = getClient();
      const response = await client.messages.create({
        model: getModel(),
        max_tokens: 2048,
        system: `${BASE_RULES}\n- El texto original está en ${languageLabel(language)}. Mantén ese idioma salvo que la instrucción pida explícitamente traducirlo.\nDevuelve ÚNICAMENTE el texto final, sin explicaciones ni comillas envolventes.`,
        messages: [
          {
            role: "user",
            content: `Texto original (${platform}, máx. ${limit} caracteres):\n${body}\n\nInstrucción: ${instructionText}`,
          },
        ],
      });

      const text = response.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text ?? body;
      return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text.trim();
    });
  }

  async scoreContent(body: string, platform: SocialPlatform, brand: BrandContext): Promise<ContentScoreResult> {
    return withErrorHandling("scoreContent", async () => {
      const client = getClient();
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 1536,
        system: OPERATOR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              `Evalúa este contenido para ${platform} (límite ${PLATFORM_CHAR_LIMITS[platform]} caracteres) con un Content Score de 0 a 100 y un desglose de 0 a 100 en: hook, clarity, platformFit, brandConsistency, engagementPotential, cta, length, originality.`,
              renderBrandContext(brand),
              `Contenido a evaluar:\n"""\n${body}\n"""`,
              "Da entre 1 y 4 recomendaciones concretas y accionables para mejorar la puntuación.",
            ].join("\n\n"),
          },
        ],
        output_config: { format: zodOutputFormat(contentScoreResponseSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió una puntuación en el formato esperado.");
      }
      return response.parsed_output;
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
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 2048,
        system: OPERATOR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              `Analiza el siguiente texto extraído de la web ${url} y construye la base del Brand Brain de esta empresa.`,
              "Identifica: un resumen breve, los servicios/productos detectados, los mensajes clave, el tono de comunicación predominante, y de 3 a 5 pilares de contenido sugeridos (nombre + descripción).",
              "Basa todo exclusivamente en el texto proporcionado; no inventes servicios que no aparezcan.",
              `Texto de la web:\n"""\n${text}\n"""`,
            ].join("\n\n"),
          },
        ],
        output_config: { format: zodOutputFormat(websiteAnalysisResponseSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió el análisis de la web en el formato esperado.");
      }
      return response.parsed_output;
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
      const response = await client.messages.parse({
        model: getModel(),
        max_tokens: 2048,
        system: OPERATOR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              "Analiza este resumen de métricas de redes sociales (JSON) y redacta un análisis de rendimiento en español, orientado a acción.",
              "Basa las recomendaciones únicamente en los datos proporcionados; si un dato no está presente (p.ej. mejor horario), omítelo en vez de inventarlo.",
              `Métricas:\n${JSON.stringify(metricsSummary, null, 2)}`,
            ].join("\n\n"),
          },
        ],
        output_config: { format: zodOutputFormat(performanceInsightResponseSchema) },
      });

      if (!response.parsed_output) {
        throw new Error("Claude no devolvió el análisis de rendimiento en el formato esperado.");
      }
      return response.parsed_output;
    });
  }
}

