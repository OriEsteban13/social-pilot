import type { ContentFormat, ContentKind, SocialPlatform, Tone } from "@/lib/enums";

/**
 * Contexto de marca que se pasa a cualquier función de IA. Es la proyección
 * del Brand Brain (BrandProfile + ContentPillar[] + BrandAsset[]) que el
 * proveedor usa para no inventar información. Si un campo relevante está
 * vacío, el proveedor debe marcar el resultado como `needsValidation: true`
 * en lugar de rellenarlo con datos ficticios.
 */
export interface BrandContext {
  workspaceName: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  valueProposition?: string | null;
  /** Código de idioma (es, en, fr...) en el que debe redactarse el contenido nuevo — ver src/lib/languages.ts. */
  language: string;
  /**
   * Idioma en el que está realmente escrito el texto libre del Brand Brain
   * (descripción, propuesta de valor, diferenciadores, pilares) — normalmente
   * el idioma por defecto del workspace, sin aplicar ningún override puntual
   * de `language`. Un proveedor que no traduce de verdad (MockAIProvider) lo
   * usa para no mezclar ese texto tal cual dentro de una publicación pedida
   * en otro idioma. Si no se indica, se asume igual a `language`.
   */
  nativeLanguage?: string;
  tone: Tone;
  toneCustom?: string | null;
  targetAudiences: string[];
  differentiators: string[];
  claims: string[];
  allowedTerms: string[];
  forbiddenTerms: string[];
  pillars: { id: string; name: string; description?: string | null }[];
}

export interface GenerateIdeasInput {
  brand: BrandContext;
  count: number;
  sourceHint?: string; // p.ej. "web", "documento X", "rendimiento del mes"
  goals?: string[];
  excludeTitles?: string[]; // ideas ya generadas/publicadas, para no repetir
  /** SOCIAL_POST (por defecto) o BLOG_ARTICLE — determina si las ideas llevan recommendedPlatform/recommendedFormat o son temas de blog. */
  contentKind?: ContentKind;
}

export interface IdeaDraft {
  title: string;
  description: string;
  pillarName?: string;
  goal?: string;
  audience?: string;
  /** Solo presente cuando contentKind es SOCIAL_POST. */
  recommendedPlatform?: SocialPlatform;
  /** Solo presente cuando contentKind es SOCIAL_POST. */
  recommendedFormat?: ContentFormat;
  priority: "LOW" | "MEDIUM" | "HIGH";
  rationale: string;
  cta: string;
  sourceType: string;
  needsValidation: boolean;
  contentKind: ContentKind;
  /**
   * Idioma en el que el título/descripción quedaron REALMENTE redactados —
   * puede diferir de `brand.language` si el proveedor no pudo (o no tuvo que)
   * redactar exactamente en el idioma pedido (p.ej. MockAIProvider cayendo al
   * idioma real del Brand Brain para no mezclar idiomas). Quien persiste esta
   * idea debe guardar este valor, no `brand.language`, para que una futura
   * generación de contenido a partir de ella sepa con certeza en qué idioma
   * está escrita.
   */
  effectiveLanguage: string;
}

export interface GenerateBlogArticleInput {
  brand: BrandContext;
  brief: string;
  /** Idioma real en el que está escrito `brief` (p.ej. el de la idea de origen), si se conoce y puede diferir de `brand.language`. */
  briefLanguage?: string;
  pillarName?: string;
  targetWordCount?: number; // por defecto ~600-900 palabras
}

export interface BlogArticleDraft {
  title: string;
  metaDescription: string;
  body: string; // texto largo con párrafos separados por saltos de línea dobles
  tags: string[];
  cta: string;
  needsValidation: boolean;
}

export interface GenerateVariantInput {
  brand: BrandContext;
  platform: SocialPlatform;
  format: ContentFormat;
  brief: string; // idea, url, texto base, etc.
  /** Idioma real en el que está escrito `brief` (p.ej. el de la idea de origen), si se conoce y puede diferir de `brand.language`. */
  briefLanguage?: string;
  campaignGoal?: string;
}

export interface VariantDraft {
  body: string;
  hashtags: string[];
  cta: string;
  altText?: string;
  charCount: number;
  needsValidation: boolean;
  scriptScenes?: { screenText: string; voiceover: string; durationSeconds: number }[]; // solo TikTok/Reel
}

export type AdjustInstruction =
  | "SHORTEN"
  | "LENGTHEN"
  | "MORE_COMMERCIAL"
  | "MORE_EDUCATIONAL"
  | "ADD_EMOJIS"
  | "REMOVE_EMOJIS"
  | "CHANGE_TONE"
  | "PROOFREAD"
  | "ADD_CTA"
  | "TRANSLATE";

export interface AdjustCopyInput {
  body: string;
  instruction: AdjustInstruction;
  targetTone?: Tone;
  targetLanguage?: string;
  platform: SocialPlatform;
  /** Idioma en el que ya está redactado `body` (el idioma activo del workspace) — necesario para que un proveedor basado en plantillas (mock) no mezcle idiomas al ajustar el texto. */
  language: string;
}

export interface ContentScoreBreakdown {
  hook: number;
  clarity: number;
  platformFit: number;
  brandConsistency: number;
  engagementPotential: number;
  cta: number;
  length: number;
  originality: number;
}

export interface ContentScoreResult {
  score: number; // 0-100
  breakdown: ContentScoreBreakdown;
  recommendations: string[];
}

export interface WebsiteAnalysisResult {
  summary: string;
  detectedServices: string[];
  keyMessages: string[];
  detectedTone: Tone;
  suggestedPillars: { name: string; description: string }[];
  needsValidation: boolean;
}

export interface PerformanceInsight {
  summary: string;
  topPerformers: string[];
  underperformers: string[];
  recommendations: string[];
  bestTimeToPost?: string;
  bestTone?: string;
  bestFormat?: string;
  bestCta?: string;
}

/**
 * Interfaz común a cualquier proveedor de IA. La implementación activa se
 * resuelve vía `AI_PROVIDER` (ver src/server/ai/registry.ts). Todas las
 * funciones son async para permitir implementaciones reales basadas en
 * llamadas HTTP sin cambiar la forma de uso.
 */
export interface AIProvider {
  readonly id: string;
  generateIdeas(input: GenerateIdeasInput): Promise<IdeaDraft[]>;
  generateVariant(input: GenerateVariantInput): Promise<VariantDraft>;
  generateBlogArticle(input: GenerateBlogArticleInput): Promise<BlogArticleDraft>;
  adjustCopy(input: AdjustCopyInput): Promise<string>;
  scoreContent(body: string, platform: SocialPlatform, brand: BrandContext): Promise<ContentScoreResult>;
  analyzeWebsite(url: string, rawText?: string): Promise<WebsiteAnalysisResult>;
  summarizePerformance(metricsSummary: Record<string, unknown>): Promise<PerformanceInsight>;
}
