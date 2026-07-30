import { afterEach, describe, expect, it, vi } from "vitest";
import { MockAIProvider } from "@/server/ai/providers/mock";
import type { BrandContext } from "@/server/ai/types";

const emptyBrand: BrandContext = {
  workspaceName: "Acme",
  language: "es",
  tone: "CERCANO",
  targetAudiences: [],
  differentiators: [],
  claims: [],
  allowedTerms: [],
  forbiddenTerms: [],
  pillars: [],
};

const richBrand: BrandContext = {
  ...emptyBrand,
  description: "Plataforma de encuestas con IA.",
  valueProposition: "De la respuesta al insight en segundos.",
  pillars: [{ id: "p1", name: "Producto", description: "Novedades de producto" }],
};

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  it("marks generated ideas as needing validation when the Brand Brain is empty", async () => {
    const ideas = await provider.generateIdeas({ brand: emptyBrand, count: 3 });
    expect(ideas).toHaveLength(3);
    expect(ideas.every((i) => i.needsValidation)).toBe(true);
  });

  it("does not flag ideas as needing validation once the Brand Brain has content", async () => {
    const ideas = await provider.generateIdeas({ brand: richBrand, count: 2 });
    expect(ideas.every((i) => i.needsValidation)).toBe(false);
  });

  it("respects the X (Twitter) character limit", async () => {
    const variant = await provider.generateVariant({
      brand: richBrand,
      platform: "X",
      format: "POST",
      brief: "Un anuncio de producto con un titular bastante largo para forzar el truncado del texto generado",
    });
    expect(variant.body.length).toBeLessThanOrEqual(280);
  });

  it("scores content with a hook and a CTA higher than content without either", async () => {
    const withHookAndCta = await provider.scoreContent(
      "¿Sabías que el 90% de las encuestas mal diseñadas pierden respuestas?\nDescubre cómo evitarlo.",
      "LINKEDIN",
      richBrand
    );
    const bare = await provider.scoreContent("texto", "LINKEDIN", richBrand);
    expect(withHookAndCta.score).toBeGreaterThan(bare.score);
  });

  it("flags content containing a forbidden term with low brand-consistency score", async () => {
    const brandWithForbidden: BrandContext = { ...richBrand, forbiddenTerms: ["gratis para siempre"] };
    const result = await provider.scoreContent("Prueba nuestro plan gratis para siempre, sin condiciones.", "LINKEDIN", brandWithForbidden);
    expect(result.breakdown.brandConsistency).toBeLessThan(50);
  });

  describe("language selection", () => {
    it("writes the variant body in English when brand.language is 'en'", async () => {
      const englishBrand: BrandContext = { ...richBrand, language: "en" };
      const variant = await provider.generateVariant({
        brand: englishBrand,
        platform: "LINKEDIN",
        format: "POST",
        brief: "survey automation",
      });
      // The English hook templates start with English words; Spanish ones don't.
      expect(variant.body).toMatch(/^(Did you know|3 things|Most teams|Here's what|survey automation:)/i);
      expect(variant.needsValidation).toBe(false);
    });

    it("writes the variant body in Spanish when brand.language is 'es'", async () => {
      const variant = await provider.generateVariant({
        brand: richBrand, // language: "es"
        platform: "LINKEDIN",
        format: "POST",
        brief: "automatización de encuestas",
      });
      expect(variant.body).toMatch(/^(¿Sabías|3 cosas|La mayoría|Esto es lo que|automatización de encuestas:)/i);
    });

    it("falls back to English templates and flags needsValidation for an unsupported language", async () => {
      const frenchBrand: BrandContext = { ...richBrand, language: "fr" };
      const variant = await provider.generateVariant({
        brand: frenchBrand,
        platform: "LINKEDIN",
        format: "POST",
        brief: "automatisation des sondages",
      });
      expect(variant.body).toMatch(/^(Did you know|3 things|Most teams|Here's what|automatisation des sondages:)/i);
      expect(variant.needsValidation).toBe(true);
    });

    it("generates idea titles using the language-specific angle vocabulary", async () => {
      const englishBrand: BrandContext = { ...richBrand, language: "en" };
      const ideas = await provider.generateIdeas({ brand: englishBrand, count: 3 });
      const englishAngles = ["A practical guide to", "Trends in", "Myths and truths about", "3 keys to", "Use case:", "Frequently asked questions about", "Behind the scenes:", "What we learned about"];
      for (const idea of ideas) {
        expect(englishAngles.some((angle) => idea.title.startsWith(angle))).toBe(true);
      }
    });

    it("does not embed the platform in the idea title (regression: '... (INSTAGRAM' used to leak into the generated post copy)", async () => {
      const ideas = await provider.generateIdeas({ brand: richBrand, count: 6 });
      expect(ideas.length).toBe(6);
      for (const idea of ideas) {
        expect(idea.title).not.toMatch(/\((LINKEDIN|INSTAGRAM|TIKTOK|THREADS|X)\)?$/i);
      }
    });

    it("still reaches the requested count even though the title no longer disambiguates by platform", async () => {
      // Con un único pilar, varias plataformas pueden generar el mismo
      // título "limpio" — el deduplicado ya no debe rechazarlas todas salvo
      // la primera (antes dependía de que la plataforma fuera parte del
      // texto del título para no colisionar).
      const singlePillarBrand: BrandContext = {
        ...richBrand,
        pillars: [{ id: "p1", name: "Producto", description: "Novedades de producto" }],
      };
      const ideas = await provider.generateIdeas({ brand: singlePillarBrand, count: 8 });
      expect(ideas.length).toBe(8);
    });
  });

  describe("language mismatch — never mix languages in the same piece", () => {
    it("falls back the whole variant to the brief's real language instead of embedding it mid-sentence in another language (regression: 'Did you know {título en español}...')", async () => {
      const englishBrand: BrandContext = { ...richBrand, language: "en", nativeLanguage: "en" };
      const variant = await provider.generateVariant({
        brand: englishBrand,
        platform: "LINKEDIN",
        format: "POST",
        brief: "Cómo crear y optimizar encuestas y formularios efectivos",
        briefLanguage: "es", // el brief viene de una idea redactada en español
      });
      // Nada de hooks en inglés con el topic en español metido en medio.
      expect(variant.body).not.toMatch(/^(Did you know|Most teams|Here's what)/i);
      expect(variant.body).toMatch(/^(¿Sabías|3 cosas|La mayoría|Esto es lo que)/i);
      expect(variant.needsValidation).toBe(true);
    });

    it("uses a generic value line instead of raw untranslated Brand Brain text when the brand text language doesn't match the requested language", async () => {
      const mismatchedBrand: BrandContext = { ...richBrand, language: "en", nativeLanguage: "es" };
      const variant = await provider.generateVariant({
        brand: mismatchedBrand,
        platform: "LINKEDIN",
        format: "POST",
        brief: "survey automation", // brief ya en inglés (p.ej. escrito a mano en "Nuevo contenido")
      });
      expect(variant.body).not.toContain(richBrand.valueProposition);
      expect(variant.body).not.toContain("Análisis con IA incluido");
      expect(variant.body).toContain(`At ${richBrand.workspaceName} we work on this every day.`);
      expect(variant.needsValidation).toBe(true);
    });

    it("keeps full brand personalization when brand text and requested language match (no regression on the happy path)", async () => {
      const matchedBrand: BrandContext = { ...richBrand, language: "es", nativeLanguage: "es", differentiators: ["Análisis con IA incluido"] };
      const variant = await provider.generateVariant({
        brand: matchedBrand,
        platform: "LINKEDIN",
        format: "POST",
        brief: "automatización de encuestas",
      });
      expect(variant.body).toContain(richBrand.valueProposition);
      expect(variant.body).toContain("Análisis con IA incluido");
    });

    it("keeps the idea title fully in the Brand Brain's real language instead of a translated angle glued to an untranslated topic", async () => {
      const mismatchedBrand: BrandContext = { ...richBrand, language: "en", nativeLanguage: "es" };
      const ideas = await provider.generateIdeas({ brand: mismatchedBrand, count: 3 });
      const spanishAngles = ["Guía práctica sobre", "Tendencias en", "Mitos y verdades sobre", "3 claves de", "Caso de uso:", "Preguntas frecuentes sobre", "Detrás de escenas:", "Lo que aprendimos sobre"];
      for (const idea of ideas) {
        expect(spanishAngles.some((angle) => idea.title.startsWith(angle))).toBe(true);
        expect(idea.effectiveLanguage).toBe("es");
        expect(idea.needsValidation).toBe(true);
      }
    });

    it("stamps effectiveLanguage equal to the requested language when there's no mismatch", async () => {
      const englishBrand: BrandContext = { ...richBrand, language: "en", nativeLanguage: "en" };
      const ideas = await provider.generateIdeas({ brand: englishBrand, count: 2 });
      for (const idea of ideas) expect(idea.effectiveLanguage).toBe("en");
    });

    it("falls back the whole blog article to the brief's real language instead of mixing it into a foreign intro sentence", async () => {
      const englishBrand: BrandContext = { ...richBrand, language: "en", nativeLanguage: "en" };
      const draft = await provider.generateBlogArticle({
        brand: englishBrand,
        brief: "Cómo elegir un software de encuestas",
        briefLanguage: "es",
      });
      expect(draft.body).not.toContain("In this article we look at why this matters");
      expect(draft.body).toContain("En este artículo repasamos por qué esto importa");
      expect(draft.needsValidation).toBe(true);
    });
  });

  describe("adjustCopy — language consistency", () => {
    it("appends a Spanish phrase when language is 'es', never the English one", async () => {
      const result = await provider.adjustCopy({
        body: "This is already-generated English copy.",
        instruction: "LENGTHEN",
        platform: "LINKEDIN",
        language: "es",
      });
      expect(result).toContain("Más contexto: este contenido forma parte");
      expect(result).not.toContain("More context: this content is part");
    });

    it("appends an English phrase when language is 'en', never the Spanish one", async () => {
      const result = await provider.adjustCopy({
        body: "Este es un texto ya generado en español.",
        instruction: "LENGTHEN",
        platform: "LINKEDIN",
        language: "en",
      });
      expect(result).toContain("More context: this content is part");
      expect(result).not.toContain("Más contexto: este contenido forma parte");
    });

    it("keeps MORE_COMMERCIAL, MORE_EDUCATIONAL and ADD_CTA in the requested language", async () => {
      const base = { body: "Copy.", platform: "LINKEDIN" as const, language: "en" };
      const commercial = await provider.adjustCopy({ ...base, instruction: "MORE_COMMERCIAL" });
      const educational = await provider.adjustCopy({ ...base, instruction: "MORE_EDUCATIONAL" });
      const cta = await provider.adjustCopy({ ...base, instruction: "ADD_CTA" });
      expect(commercial).toContain("Want to know more?");
      expect(educational).toContain("Key takeaway:");
      expect(cta).toContain("Let's talk?");
    });

    it("uses the localized 'Tone' label for CHANGE_TONE depending on language", async () => {
      const es = await provider.adjustCopy({ body: "Texto.", instruction: "CHANGE_TONE", platform: "LINKEDIN", language: "es", targetTone: "TECNICO" });
      const en = await provider.adjustCopy({ body: "Text.", instruction: "CHANGE_TONE", platform: "LINKEDIN", language: "en", targetTone: "TECNICO" });
      expect(es).toMatch(/^\[Tono:/);
      expect(en).toMatch(/^\[Tone:/);
    });
  });

  describe("blog articles", () => {
    it("generates blog ideas without a recommended platform/format", async () => {
      const ideas = await provider.generateIdeas({ brand: richBrand, count: 3, contentKind: "BLOG_ARTICLE" });
      expect(ideas).toHaveLength(3);
      for (const idea of ideas) {
        expect(idea.contentKind).toBe("BLOG_ARTICLE");
        expect(idea.recommendedPlatform).toBeUndefined();
        expect(idea.recommendedFormat).toBeUndefined();
        // Los títulos de post social incluyen la red entre paréntesis, p.ej. "(LINKEDIN)"; los de blog no.
        expect(idea.title).not.toMatch(/\(LINKEDIN|INSTAGRAM|TIKTOK|THREADS|X\)$/);
      }
    });

    it("defaults to SOCIAL_POST ideas when contentKind is omitted", async () => {
      const ideas = await provider.generateIdeas({ brand: richBrand, count: 2 });
      for (const idea of ideas) {
        expect(idea.contentKind).toBe("SOCIAL_POST");
        expect(idea.recommendedPlatform).toBeDefined();
      }
    });

    it("generates a blog article body close to the target word count", async () => {
      const draft = await provider.generateBlogArticle({ brand: richBrand, brief: "Cómo elegir un software de encuestas", targetWordCount: 300 });
      const wordCount = draft.body.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(200);
      expect(draft.title.length).toBeGreaterThan(0);
      expect(draft.metaDescription.length).toBeLessThanOrEqual(155);
      expect(draft.needsValidation).toBe(false);
    });

    it("flags needsValidation when the Brand Brain lacks context", async () => {
      const draft = await provider.generateBlogArticle({ brand: emptyBrand, brief: "Tema genérico" });
      expect(draft.needsValidation).toBe(true);
    });
  });

  describe("analyzeWebsite", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches the URL itself when no rawText is provided (regression: used to always report needsValidation)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () =>
            "<html><body><p>Camaleonic Survey es una plataforma de encuestas con IA para escuchar a clientes, empleados y proveedores, con dashboards en tiempo real. Ayuda a consultoras y equipos de experiencia de cliente a convertir respuestas en decisiones accionables, con paneles en vivo y alertas automáticas.</p></body></html>",
        } as Response)
      );

      const result = await provider.analyzeWebsite("https://example.com");
      expect(result.needsValidation).toBe(false);
      expect(result.detectedServices.length).toBeGreaterThan(0);
    });

    it("reports needsValidation when the site can't be fetched, without throwing", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      const result = await provider.analyzeWebsite("https://example.com");
      expect(result.needsValidation).toBe(true);
      expect(result.summary).toContain("No se ha podido leer");
    });

    it("still honors an explicitly passed rawText without calling fetch", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const longText = "Contenido de sobra para superar el umbral mínimo de caracteres exigido en el análisis de la web. ".repeat(3);
      const result = await provider.analyzeWebsite("https://example.com", longText);
      expect(result.needsValidation).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
