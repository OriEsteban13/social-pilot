import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  blogArticleResponseSchema,
  contentScoreResponseSchema,
  generateIdeasResponseSchema,
  performanceInsightResponseSchema,
  variantDraftSchema,
  websiteAnalysisResponseSchema,
} from "@/server/ai/providers/anthropic-schemas";

/**
 * GroqAIProvider convierte estos mismos esquemas Zod (compartidos con
 * AnthropicAIProvider) a JSON Schema con `z.toJSONSchema()` para pedirle a
 * Groq "Structured Outputs" — si algún esquema usara una construcción de Zod
 * no representable en JSON Schema, esto fallaría en tiempo de ejecución la
 * primera vez que alguien generara contenido con AI_PROVIDER=groq. Se
 * comprueba aquí, sin llamar a la API real.
 */
describe("Zod → JSON Schema conversion for Groq Structured Outputs", () => {
  const schemas = {
    generateIdeasResponseSchema,
    variantDraftSchema,
    blogArticleResponseSchema,
    contentScoreResponseSchema,
    websiteAnalysisResponseSchema,
    performanceInsightResponseSchema,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`converts ${name} without throwing and produces a JSON object schema`, () => {
      const jsonSchema = z.toJSONSchema(schema);
      expect(jsonSchema.type).toBe("object");
      expect(jsonSchema.properties).toBeTruthy();
    });
  }

  it("round-trips a valid payload through JSON Schema-shaped data back into the Zod schema", () => {
    const payload = {
      body: "Texto de ejemplo.",
      hashtags: ["#uno", "#dos"],
      cta: "Descúbrelo aquí",
      needsValidation: false,
    };
    // Simula lo que hace GroqAIProvider: JSON.parse(contenido del modelo) + schema.parse(...).
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(() => variantDraftSchema.parse(roundTripped)).not.toThrow();
  });
});
