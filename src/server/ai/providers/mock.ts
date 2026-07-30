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
import type { SocialPlatform, Tone } from "@/lib/enums";
import { CONTENT_FORMATS } from "@/lib/enums";
import { hashSeed, pick } from "@/lib/seeded-pick";
import { fetchWebsiteText } from "../website-fetch";
import { PLATFORM_CHAR_LIMITS } from "@/lib/platform-limits";
import { languageLabel } from "@/lib/languages";

/**
 * Proveedor de IA por defecto: no realiza ninguna llamada externa. Genera
 * contenido determinista basado en plantillas + el Brand Brain real del
 * workspace, para que el producto sea completamente funcional sin
 * credenciales de ningún LLM. Nunca inventa datos de negocio: cuando el
 * Brand Brain no tiene suficiente información, marca `needsValidation: true`.
 *
 * Activar un proveedor real (Anthropic, OpenAI...) es cuestión de implementar
 * esta misma interfaz y cambiar `AI_PROVIDER` — ver src/server/ai/registry.ts.
 *
 * Idioma: solo hay plantillas propias en español ("es") e inglés ("en") —
 * ver `resolveTemplateLang`. Cualquier otro `brand.language` (fr, de...) usa
 * las plantillas en inglés como mejor aproximación genérica y se marca
 * `needsValidation: true`, ya que el mock no traduce de verdad. Los textos
 * internos de la app (rationale, recomendaciones del Content Score, etc.) se
 * quedan en español, que es el idioma de la propia interfaz.
 *
 * IMPORTANTE — nunca mezclar idiomas dentro de una misma pieza: el mock no
 * traduce texto libre (brief, descripción/propuesta de valor/diferenciadores
 * del Brand Brain, descripción de los pilares). Si ese texto ya existente no
 * está en el idioma pedido (`brand.language`), no se inserta tal cual dentro
 * de una plantilla en otro idioma — en su lugar, o bien toda la pieza cae al
 * idioma real de ese texto (cuando es indispensable, p.ej. el brief), o bien
 * se sustituye por una frase genérica ya redactada en el idioma pedido
 * (cuando existe una alternativa razonable, p.ej. la propuesta de valor). En
 * ambos casos se marca `needsValidation: true` explicando el motivo — un
 * proveedor real (Anthropic) sí traduce de verdad y no necesita esta cautela.
 */

type TemplateLang = "es" | "en";

function resolveTemplateLang(language: string): TemplateLang {
  return language === "en" ? "en" : language === "es" ? "es" : "en";
}

function isUnsupportedLanguage(language: string): boolean {
  return language !== "es" && language !== "en";
}

const IDEA_ANGLES: Record<TemplateLang, string[]> = {
  es: [
    "Guía práctica sobre",
    "Tendencias en",
    "Mitos y verdades sobre",
    "3 claves de",
    "Caso de uso:",
    "Preguntas frecuentes sobre",
    "Detrás de escenas:",
    "Lo que aprendimos sobre",
  ],
  en: [
    "A practical guide to",
    "Trends in",
    "Myths and truths about",
    "3 keys to",
    "Use case:",
    "Frequently asked questions about",
    "Behind the scenes:",
    "What we learned about",
  ],
};

const HOOKS: Record<TemplateLang, string[]> = {
  es: [
    "¿Sabías que {topic} puede cambiar por completo la forma en que trabajas?",
    "3 cosas que aprendimos sobre {topic} este mes.",
    "La mayoría de equipos se equivoca con {topic}. Así lo hacemos nosotros.",
    "Esto es lo que nadie te cuenta sobre {topic}.",
    "{topic}: la pregunta que más nos hacen nuestros clientes.",
  ],
  en: [
    "Did you know {topic} can completely change the way you work?",
    "3 things we learned about {topic} this month.",
    "Most teams get {topic} wrong. Here's how we do it.",
    "Here's what nobody tells you about {topic}.",
    "{topic}: the question our customers ask us the most.",
  ],
};

const CTA_BY_GOAL: Record<TemplateLang, Record<string, string[]>> = {
  es: {
    LEADS: ["Reserva una demo gratuita", "Habla con nuestro equipo", "Solicita acceso anticipado"],
    TRAFFIC: ["Lee el artículo completo", "Descúbrelo en nuestra web", "Más detalles en el enlace"],
    AWARENESS: ["Síguenos para no perdértelo", "Comparte si te resulta útil", "Guarda este post"],
    DEFAULT: ["Cuéntanos qué opinas", "Escríbenos en comentarios", "Descúbrelo aquí"],
  },
  en: {
    LEADS: ["Book a free demo", "Talk to our team", "Request early access"],
    TRAFFIC: ["Read the full article", "Discover it on our website", "More details in the link"],
    AWARENESS: ["Follow us so you don't miss it", "Share it if you find it useful", "Save this post"],
    DEFAULT: ["Tell us what you think", "Let us know in the comments", "Discover it here"],
  },
};

// Frases fijas que `adjustCopy` (mock) añade al texto ya generado. Deben
// coincidir con el idioma del contenido (`AdjustCopyInput.language`) — si no,
// se mezclan idiomas dentro de la misma publicación.
const ADJUST_PHRASES: Record<TemplateLang, { lengthen: string; moreCommercial: string; moreEducational: string; addCta: string; toneLabelPrefix: string }> = {
  es: {
    lengthen: "\n\nMás contexto: este contenido forma parte de nuestra estrategia continua de comunicación.",
    moreCommercial: "\n\n¿Quieres saber más? Hablemos.",
    moreEducational: "\n\nDato clave: este es uno de los aprendizajes que compartimos con nuestra comunidad.",
    addCta: "\n\n¿Hablamos?",
    toneLabelPrefix: "Tono",
  },
  en: {
    lengthen: "\n\nMore context: this content is part of our ongoing communication strategy.",
    moreCommercial: "\n\nWant to know more? Let's talk.",
    moreEducational: "\n\nKey takeaway: this is one of the things we share with our community.",
    addCta: "\n\nLet's talk?",
    toneLabelPrefix: "Tone",
  },
};

// Fragmentos de texto para `generateBlogArticle` (mock). Un artículo real
// necesitaría redacción real (proveedor Anthropic); esto solo aproxima la
// forma y longitud de un artículo de blog para que la función sea usable
// sin credenciales de ningún LLM.
const BLOG_COPY: Record<
  TemplateLang,
  {
    genericValueLine: (workspaceName: string) => string;
    intro: (brief: string, workspaceName: string) => string;
    differentiators: (items: string[]) => string;
    pillarParagraph: (name: string, description: string) => string;
    closing: (workspaceName: string) => string;
    metaSuffix: string;
  }
> = {
  es: {
    genericValueLine: (workspaceName) => `En ${workspaceName} trabajamos cada día en esto.`,
    intro: (brief, workspaceName) => `${brief}. En este artículo repasamos por qué esto importa y cómo lo abordamos desde ${workspaceName}.`,
    differentiators: (items) => `Lo que nos diferencia: ${items.join("; ")}.`,
    pillarParagraph: (name, description) => `Este artículo forma parte de "${name}": ${description}.`,
    closing: (workspaceName) => `Si quieres profundizar en este tema o ver cómo lo aplicamos en ${workspaceName}, ponte en contacto con nuestro equipo.`,
    metaSuffix: "Descubre más en nuestro blog.",
  },
  en: {
    genericValueLine: (workspaceName) => `At ${workspaceName} we work on this every day.`,
    intro: (brief, workspaceName) => `${brief}. In this article we look at why this matters and how we approach it at ${workspaceName}.`,
    differentiators: (items) => `What sets us apart: ${items.join("; ")}.`,
    pillarParagraph: (name, description) => `This article is part of "${name}": ${description}.`,
    closing: (workspaceName) => `If you'd like to go deeper on this topic or see how we apply it at ${workspaceName}, get in touch with our team.`,
    metaSuffix: "Read more on our blog.",
  },
};

function expandToWordCount(paragraphs: string[], targetWordCount: number): string {
  const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
  const result = [...paragraphs];
  let words = result.reduce((sum, p) => sum + countWords(p), 0);
  // Repite el cuerpo (sin la intro ni el cierre) para acercarse a la
  // longitud objetivo, ya que el mock no tiene contenido real adicional que
  // añadir — un proveedor real (Anthropic) sí redacta contenido nuevo.
  const fillerParagraphs = paragraphs.slice(1, -1);
  let i = 0;
  while (words < targetWordCount && fillerParagraphs.length > 0 && i < 20) {
    const extra = fillerParagraphs[i % fillerParagraphs.length];
    result.splice(result.length - 1, 0, extra);
    words += countWords(extra);
    i++;
  }
  return result.join("\n\n");
}

function buildHashtags(brand: BrandContext, topic: string, platform: SocialPlatform): string[] {
  const base = [
    brand.workspaceName.replace(/\s+/g, ""),
    brand.industry?.replace(/\s+/g, ""),
    ...topic
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 3),
  ].filter(Boolean) as string[];

  const max = platform === "X" ? 2 : platform === "TIKTOK" ? 5 : 4;
  return Array.from(new Set(base))
    .slice(0, max)
    .map((tag) => `#${tag.replace(/[^\p{L}\p{N}]/gu, "")}`);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function brandHasEnoughContext(brand: BrandContext): boolean {
  return Boolean(brand.description || brand.valueProposition) && brand.pillars.length > 0;
}

export class MockAIProvider implements AIProvider {
  readonly id = "mock";

  async generateIdeas(input: GenerateIdeasInput): Promise<IdeaDraft[]> {
    const { brand, count, sourceHint, goals, excludeTitles = [], contentKind = "SOCIAL_POST" } = input;
    // El "topic" de cada idea sale del pilar (nombre/descripción del Brand
    // Brain) tal cual — el mock no lo traduce. Si el idioma real de ese texto
    // no coincide con el pedido, la idea completa (título, descripción,
    // ángulo) se redacta en el idioma REAL del pilar en vez de mezclar un
    // ángulo traducido con un topic sin traducir en la misma frase.
    const brandTextLanguage = brand.nativeLanguage ?? brand.language;
    const brandTextMismatch = brandTextLanguage !== brand.language;
    const effectiveLanguage = brandTextMismatch ? brandTextLanguage : isUnsupportedLanguage(brand.language) ? "en" : brand.language;
    const lang = resolveTemplateLang(effectiveLanguage);
    const needsValidation = !brandHasEnoughContext(brand) || isUnsupportedLanguage(brand.language) || brandTextMismatch;
    const pillars = brand.pillars.length > 0 ? brand.pillars : [{ id: "general", name: "General" }];
    const platforms: SocialPlatform[] = ["LINKEDIN", "INSTAGRAM", "TIKTOK", "THREADS", "X"];
    const ideas: IdeaDraft[] = [];

    // Los títulos de blog solo varían por ángulo × pilar (sin la dimensión
    // extra de red social que sí tienen los posts sociales), así que el
    // espacio de títulos únicos es más pequeño — con pocos pilares hace
    // falta más margen de intentos para no quedarse corto de `count`.
    const maxAttempts = contentKind === "BLOG_ARTICLE" ? count * 8 : count * 4;
    let attempt = 0;
    while (ideas.length < count && attempt < maxAttempts) {
      attempt++;
      const seed = hashSeed(`${brand.workspaceName}-${sourceHint ?? "auto"}-${contentKind}-${attempt}`);
      const pillar = pick(pillars, seed);
      const topic = pillar.description || pillar.name;
      const angle = pick(IDEA_ANGLES[lang], seed >> 8);
      // El ángulo (seed >> 8) y la plataforma (para posts sociales) varían por
      // intento incluso cuando solo hay un pilar disponible (p.ej. un
      // workspace recién creado), para que el título no se repita y el
      // deduplicado de abajo no descarte todos los intentos salvo el primero.
      const rationale = !brandHasEnoughContext(brand)
        ? "Sugerencia genérica: completa el Brand Brain (descripción, pilares) para ideas más precisas."
        : brandTextMismatch
          ? `Redactado en ${languageLabel(brandTextLanguage)} porque el pilar "${pillar.name}" está escrito en ese idioma en el Brand Brain y el modo mock no traduce texto de marca (mezclarlo con plantillas en ${languageLabel(brand.language)} daría un título a medio traducir). Activa un proveedor de IA real (AI_PROVIDER=anthropic) para redactarlo directamente en ${languageLabel(brand.language)}.`
          : isUnsupportedLanguage(brand.language)
            ? `Generado en inglés como aproximación: el modo mock no tiene plantillas nativas para "${brand.language}". Activa un proveedor de IA real (AI_PROVIDER=anthropic) para redactar directamente en ese idioma.`
            : `Refuerza el pilar "${pillar.name}", uno de los ejes definidos en la estrategia de ${brand.workspaceName}.`;

      if (contentKind === "BLOG_ARTICLE") {
        const title = `${angle} ${topic}`.slice(0, 90);
        if (excludeTitles.includes(title) || ideas.some((i) => i.title === title)) continue;

        ideas.push({
          title,
          description:
            lang === "en"
              ? `Long-form blog article about "${topic}", reinforcing the "${pillar.name}" pillar for the company website.${sourceHint ? ` Source: ${sourceHint}.` : ""}`
              : `Artículo de blog en profundidad sobre "${topic}", pensado para reforzar el pilar "${pillar.name}" en la web de la empresa.${
                  sourceHint ? ` Origen: ${sourceHint}.` : ""
                }`,
          pillarName: pillar.name,
          goal: goals?.[attempt % (goals.length || 1)] ?? (lang === "en" ? "SEO / organic traffic" : "SEO / tráfico orgánico"),
          audience: brand.targetAudiences[0] ?? (lang === "en" ? "General industry audience" : "Audiencia general del sector"),
          priority: attempt % 3 === 0 ? "HIGH" : attempt % 3 === 1 ? "MEDIUM" : "LOW",
          rationale,
          cta: pick(CTA_BY_GOAL[lang].DEFAULT, seed >> 6),
          sourceType: sourceHint ? mapSourceHintToType(sourceHint) : "MANUAL",
          needsValidation,
          contentKind: "BLOG_ARTICLE",
          effectiveLanguage,
        });
        continue;
      }

      const platform = pick(platforms, seed >> 2);
      const format = pick(
        CONTENT_FORMATS.filter((f) => formatFitsPlatform(f, platform)),
        seed >> 4
      );
      // El título NO lleva la plataforma metida dentro (antes sí, como
      // "... (INSTAGRAM)") — ese sufijo se colaba tal cual en el copy
      // generado cuando el título de la idea se reutilizaba como brief
      // ("... proveedores (instagram. Así lo hacemos..."). La plataforma ya
      // se distingue visualmente con el badge en la tarjeta de la idea, así
      // que no hace falta repetirla en el texto. El deduplicado usa
      // título+plataforma como clave para no rechazar la misma idea base
      // sugerida para dos redes distintas.
      const title = `${angle} ${topic}`.slice(0, 90);
      // `excludeTitles` son títulos ya guardados en sesiones anteriores (sin
      // plataforma, tal y como los devuelve la consulta a la base de datos)
      // — se evita repetir el título tal cual. Dentro de esta misma tanda sí
      // se permite el mismo título base para dos plataformas distintas (es
      // la misma idea sugerida para dos redes, no un duplicado real).
      if (excludeTitles.includes(title) || ideas.some((i) => i.title === title && i.recommendedPlatform === platform)) continue;

      ideas.push({
        title,
        description:
          lang === "en"
            ? `Content about "${topic}" designed to reinforce the "${pillar.name}" pillar on ${platform}.${sourceHint ? ` Source: ${sourceHint}.` : ""}`
            : `Contenido sobre "${topic}" pensado para reforzar el pilar "${pillar.name}" en ${platform}.${
                sourceHint ? ` Origen: ${sourceHint}.` : ""
              }`,
        pillarName: pillar.name,
        goal: goals?.[attempt % (goals.length || 1)] ?? (lang === "en" ? "Awareness" : "Notoriedad"),
        audience: brand.targetAudiences[0] ?? (lang === "en" ? "General industry audience" : "Audiencia general del sector"),
        recommendedPlatform: platform,
        recommendedFormat: format,
        priority: attempt % 3 === 0 ? "HIGH" : attempt % 3 === 1 ? "MEDIUM" : "LOW",
        rationale,
        cta: pick(CTA_BY_GOAL[lang].DEFAULT, seed >> 6),
        sourceType: sourceHint ? mapSourceHintToType(sourceHint) : "MANUAL",
        needsValidation,
        contentKind: "SOCIAL_POST",
        effectiveLanguage,
      });
    }

    return ideas;
  }

  async generateBlogArticle(input: GenerateBlogArticleInput): Promise<BlogArticleDraft> {
    const { brand, brief, briefLanguage, pillarName, targetWordCount = 700 } = input;
    // El brief se inserta literalmente en la intro ("{brief}. In this
    // article...") — si se sabe que está en otro idioma que el pedido, no hay
    // forma de "traducirlo" en modo plantilla, así que todo el artículo cae
    // al idioma real del brief para no mezclar dos idiomas en la misma frase.
    const briefMismatch = briefLanguage !== undefined && briefLanguage !== brand.language;
    const effectiveLanguage = briefMismatch ? briefLanguage : brand.language;
    const lang = resolveTemplateLang(effectiveLanguage);
    // El texto libre del Brand Brain (propuesta de valor, diferenciadores,
    // descripción de los pilares) es independiente del brief: si no está en
    // el idioma en el que va a quedar el artículo, no se inserta sin
    // traducir — se sustituye por una frase genérica ya redactada en ese
    // idioma.
    const brandTextLanguage = brand.nativeLanguage ?? brand.language;
    const canUseBrandText = brandTextLanguage === effectiveLanguage;
    const needsValidation = !brandHasEnoughContext(brand) || isUnsupportedLanguage(brand.language) || briefMismatch || !canUseBrandText;
    const t = BLOG_COPY[lang];

    const genericValueLine = t.genericValueLine(brand.workspaceName);
    const valueLine = canUseBrandText ? (brand.valueProposition ?? brand.description ?? genericValueLine) : genericValueLine;
    const differentiators = canUseBrandText ? brand.differentiators.slice(0, 3) : [];
    const pillar = brand.pillars.find((p) => p.name === pillarName) ?? brand.pillars[0];

    // El brief suele ser ya un título bien formado (p.ej. el título de una
    // ContentIdea, que ya lleva un ángulo tipo "Guía práctica sobre..."), así
    // que aquí no se le añade otro ángulo delante — evita títulos duplicados
    // del estilo "Lo que aprendimos sobre Guía práctica sobre...".
    const title = brief.slice(0, 100);

    const paragraphs = [
      t.intro(brief, brand.workspaceName),
      valueLine,
      differentiators.length ? t.differentiators(differentiators) : null,
      pillar && canUseBrandText ? t.pillarParagraph(pillar.name, pillar.description ?? pillar.name) : null,
      t.closing(brand.workspaceName),
    ].filter((p): p is string => Boolean(p));

    // Repite el último párrafo con una variación ligera hasta acercarse al
    // número de palabras objetivo — el mock no redacta contenido nuevo de
    // verdad, solo aproxima la longitud de un artículo real.
    const body = expandToWordCount(paragraphs, targetWordCount);

    return {
      title,
      metaDescription: truncate(`${valueLine} ${t.metaSuffix}`, 155),
      body,
      tags: (canUseBrandText ? [pillar?.name, brand.industry, ...differentiators.slice(0, 2)] : [pillar?.name])
        .filter((v): v is string => Boolean(v))
        .slice(0, 5),
      cta: pick(CTA_BY_GOAL[lang].DEFAULT, hashSeed(brief) >> 3),
      needsValidation,
    };
  }

  async generateVariant(input: GenerateVariantInput): Promise<VariantDraft> {
    const { brand, platform, format, brief, briefLanguage, campaignGoal } = input;
    // El brief se inserta literalmente dentro del hook ("Did you know
    // {brief}...") — si se sabe que está en otro idioma que el pedido, no hay
    // forma de "traducirlo" en modo plantilla, así que toda la pieza cae al
    // idioma real del brief para no mezclar dos idiomas en la misma frase
    // (p.ej. un hook en inglés con el título de una idea en español metido
    // en medio).
    const briefMismatch = briefLanguage !== undefined && briefLanguage !== brand.language;
    const effectiveLanguage = briefMismatch ? briefLanguage : brand.language;
    const lang = resolveTemplateLang(effectiveLanguage);
    // El texto libre del Brand Brain (propuesta de valor, diferenciadores) es
    // independiente del brief: si no está en el idioma en el que va a quedar
    // la publicación, no se inserta sin traducir — se sustituye por una frase
    // genérica ya redactada en ese idioma.
    const brandTextLanguage = brand.nativeLanguage ?? brand.language;
    const canUseBrandText = brandTextLanguage === effectiveLanguage;
    const needsValidation = !brandHasEnoughContext(brand) || isUnsupportedLanguage(brand.language) || briefMismatch || !canUseBrandText;
    const seed = hashSeed(brief + platform + format);
    const limit = PLATFORM_CHAR_LIMITS[platform];
    const hook = pick(HOOKS[lang], seed).replace("{topic}", brief.toLowerCase());
    const ctaPool = CTA_BY_GOAL[lang][campaignGoal?.toUpperCase() ?? ""] ?? CTA_BY_GOAL[lang].DEFAULT;
    const cta = pick(ctaPool, seed >> 3);

    const genericValueLine =
      lang === "en" ? `At ${brand.workspaceName} we work on this every day.` : `En ${brand.workspaceName} trabajamos cada día en esto.`;
    const valueLine = canUseBrandText ? (brand.valueProposition ?? brand.description ?? genericValueLine) : genericValueLine;

    const differentiator = canUseBrandText ? brand.differentiators[0] : undefined;

    let body: string;
    let scriptScenes: VariantDraft["scriptScenes"];

    switch (platform) {
      case "LINKEDIN": {
        const differentiatorLine =
          lang === "en" ? `What sets us apart: ${differentiator}.` : `Lo que nos diferencia: ${differentiator}.`;
        const carouselLine = lang === "en" ? "👉 Swipe to see the full breakdown." : "👉 Desliza para ver el desglose completo.";
        const lines = [
          hook,
          "",
          valueLine,
          differentiator ? differentiatorLine : undefined,
          "",
          format === "CAROUSEL" ? carouselLine : undefined,
          cta + ".",
        ].filter(Boolean);
        body = lines.join("\n");
        break;
      }
      case "INSTAGRAM": {
        body = [hook, "", valueLine, "", cta + " ✨"].join("\n");
        break;
      }
      case "TIKTOK": {
        body = `${hook} ${cta}`;
        scriptScenes = [
          { screenText: hook, voiceover: hook, durationSeconds: 3 },
          { screenText: brief, voiceover: valueLine, durationSeconds: 8 },
          { screenText: cta, voiceover: cta, durationSeconds: 4 },
        ];
        break;
      }
      case "THREADS": {
        body = `${hook}\n\n${valueLine}`;
        break;
      }
      case "X": {
        body = `${hook} ${cta}.`;
        break;
      }
    }

    body = truncate(body, limit);

    return {
      body,
      hashtags: buildHashtags(brand, brief, platform),
      cta,
      altText:
        format === "CAROUSEL" || format === "POST"
          ? lang === "en"
            ? `Image about ${brief} — ${brand.workspaceName}`
            : `Imagen sobre ${brief} — ${brand.workspaceName}`
          : undefined,
      charCount: body.length,
      needsValidation,
      scriptScenes,
    };
  }

  async adjustCopy(input: AdjustCopyInput): Promise<string> {
    const { body, instruction, targetTone, targetLanguage, platform, language } = input;
    const limit = PLATFORM_CHAR_LIMITS[platform];
    const lang = resolveTemplateLang(language);
    const phrases = ADJUST_PHRASES[lang];

    switch (instruction) {
      case "SHORTEN":
        return truncate(body, Math.floor(body.length * 0.6));
      case "LENGTHEN":
        return truncate(`${body}${phrases.lengthen}`, limit);
      case "MORE_COMMERCIAL":
        return truncate(`${body}${phrases.moreCommercial}`, limit);
      case "MORE_EDUCATIONAL":
        return truncate(`${body}${phrases.moreEducational}`, limit);
      case "ADD_EMOJIS":
        return truncate(`✨ ${body} 🚀`, limit);
      case "REMOVE_EMOJIS":
        return body.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
      case "CHANGE_TONE":
        return truncate(`[${phrases.toneLabelPrefix}: ${toneLabel(targetTone)}]\n${body}`, limit);
      case "PROOFREAD":
        return body.trim().replace(/\s+/g, " ");
      case "ADD_CTA":
        return truncate(`${body}${phrases.addCta}`, limit);
      case "TRANSLATE":
        return `[${targetLanguage ?? "en"}] ${body}`;
      default:
        return body;
    }
  }

  async scoreContent(body: string, platform: SocialPlatform, brand: BrandContext): Promise<ContentScoreResult> {
    const limit = PLATFORM_CHAR_LIMITS[platform];
    const lengthRatio = body.length / limit;
    const hasHook = body.split("\n")[0]?.length > 10;
    // Palabras de CTA en español e inglés: el contenido puede haberse
    // generado en cualquiera de los dos idiomas soportados por el mock.
    const hasCta =
      /(descubre|reserva|habla|escríbenos|comparte|guarda|síguenos|más|conoce)/i.test(body) ||
      /(discover|book|talk|comment|share|save|follow|learn more|find out|sign up|join)/i.test(body);
    const forbiddenHit = brand.forbiddenTerms.some((t) => t && body.toLowerCase().includes(t.toLowerCase()));

    const breakdown = {
      hook: hasHook ? 85 : 55,
      clarity: body.length > 20 ? 80 : 50,
      platformFit: lengthRatio <= 1 ? 90 : 40,
      brandConsistency: forbiddenHit ? 30 : 85,
      engagementPotential: hasCta ? 80 : 55,
      cta: hasCta ? 90 : 45,
      length: lengthRatio > 0.15 && lengthRatio <= 1 ? 85 : 55,
      originality: 70,
    };

    const score = Math.round(
      Object.values(breakdown).reduce((a, b) => a + b, 0) / Object.values(breakdown).length
    );

    const recommendations: string[] = [];
    if (!hasHook) recommendations.push("Refuerza la primera línea: debe enganchar en menos de 2 segundos de lectura.");
    if (!hasCta) recommendations.push("Añade una llamada a la acción clara al final.");
    if (lengthRatio > 1) recommendations.push(`El texto supera el límite recomendado para ${platform} (${limit} caracteres).`);
    if (forbiddenHit) recommendations.push("El texto contiene una palabra marcada como prohibida en el Brand Brain.");
    if (recommendations.length === 0) recommendations.push("Buen contenido: cumple los criterios básicos de calidad.");

    return { score, breakdown, recommendations };
  }

  async analyzeWebsite(url: string, rawText?: string): Promise<WebsiteAnalysisResult> {
    const text = rawText ?? (await fetchWebsiteText(url));
    const hasContent = Boolean(text && text.length > 200);
    return {
      summary: hasContent
        ? `Análisis automático de ${url}: se ha detectado contenido corporativo relevante para construir el Brand Brain.`
        : `No se ha podido leer suficiente contenido de ${url}. Completa el Brand Brain manualmente o vuelve a intentar el análisis.`,
      detectedServices: hasContent ? ["Servicio principal detectado en la web"] : [],
      keyMessages: hasContent ? ["Mensaje clave extraído de la home"] : [],
      detectedTone: "CERCANO",
      suggestedPillars: hasContent
        ? [
            { name: "Producto", description: "Funcionalidades y novedades del producto" },
            { name: "Casos de éxito", description: "Resultados obtenidos por clientes" },
            { name: "Educativo", description: "Contenido que enseña sobre el sector" },
          ]
        : [],
      needsValidation: !hasContent,
    };
  }

  async summarizePerformance(metricsSummary: Record<string, unknown>): Promise<PerformanceInsight> {
    const hasData = Object.keys(metricsSummary).length > 0;
    return {
      summary: hasData
        ? "Resumen generado a partir de las métricas disponibles del periodo."
        : "Todavía no hay suficientes publicaciones con métricas para generar un análisis fiable.",
      topPerformers: hasData ? ["Ver 'Contenidos más exitosos' en Analítica"] : [],
      underperformers: [],
      recommendations: hasData
        ? ["Repite el formato y horario de las publicaciones con mejor rendimiento."]
        : ["Publica de forma constante durante 2-3 semanas para empezar a obtener recomendaciones fiables."],
      bestTimeToPost: hasData ? "Martes y jueves, 10:00–11:00" : undefined,
      bestTone: hasData ? "Cercano" : undefined,
      bestFormat: hasData ? "Carrusel" : undefined,
      bestCta: hasData ? "Pregunta abierta en el pie de foto" : undefined,
    };
  }
}


function toneLabel(tone?: Tone): string {
  return tone ?? "CERCANO";
}

function mapSourceHintToType(hint: string): string {
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

function formatFitsPlatform(format: string, platform: SocialPlatform): boolean {
  const map: Record<SocialPlatform, string[]> = {
    LINKEDIN: ["POST", "CAROUSEL", "DOCUMENT", "POLL", "VIDEO"],
    INSTAGRAM: ["POST", "CAROUSEL", "REEL", "STORY"],
    TIKTOK: ["VIDEO"],
    THREADS: ["POST", "THREAD"],
    X: ["POST", "THREAD"],
  };
  return map[platform].includes(format);
}
