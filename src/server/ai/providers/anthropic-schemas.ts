import { z } from "zod";
import { SOCIAL_PLATFORMS, CONTENT_FORMATS, TONES } from "@/lib/enums";

/**
 * Esquemas Zod usados como `output_config.format` (structured outputs) en
 * las llamadas a la API de Claude — ver AnthropicAIProvider. Se mantienen en
 * un archivo aparte porque reflejan 1:1 los tipos de src/server/ai/types.ts;
 * si esos tipos cambian, estos esquemas deben actualizarse igual.
 */

export const ideaDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  pillarName: z.string().optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  // Solo se rellenan cuando se piden ideas de tipo SOCIAL_POST — para
  // BLOG_ARTICLE no aplican (un artículo de blog no tiene "red" ni "formato").
  recommendedPlatform: z.enum(SOCIAL_PLATFORMS).optional(),
  recommendedFormat: z.enum(CONTENT_FORMATS).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  rationale: z.string(),
  cta: z.string(),
  needsValidation: z.boolean(),
});

export const generateIdeasResponseSchema = z.object({
  ideas: z.array(ideaDraftSchema),
});

export const blogArticleResponseSchema = z.object({
  title: z.string(),
  metaDescription: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  cta: z.string(),
  needsValidation: z.boolean(),
});

export const variantDraftSchema = z.object({
  body: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  altText: z.string().optional(),
  needsValidation: z.boolean(),
  scriptScenes: z
    .array(
      z.object({
        screenText: z.string(),
        voiceover: z.string(),
        durationSeconds: z.number(),
      })
    )
    .optional(),
});

export const contentScoreResponseSchema = z.object({
  score: z.number().min(0).max(100),
  breakdown: z.object({
    hook: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    platformFit: z.number().min(0).max(100),
    brandConsistency: z.number().min(0).max(100),
    engagementPotential: z.number().min(0).max(100),
    cta: z.number().min(0).max(100),
    length: z.number().min(0).max(100),
    originality: z.number().min(0).max(100),
  }),
  recommendations: z.array(z.string()),
});

export const websiteAnalysisResponseSchema = z.object({
  summary: z.string(),
  detectedServices: z.array(z.string()),
  keyMessages: z.array(z.string()),
  detectedTone: z.enum(TONES),
  suggestedPillars: z.array(z.object({ name: z.string(), description: z.string() })),
  needsValidation: z.boolean(),
});

export const performanceInsightResponseSchema = z.object({
  summary: z.string(),
  topPerformers: z.array(z.string()),
  underperformers: z.array(z.string()),
  recommendations: z.array(z.string()),
  bestTimeToPost: z.string().optional(),
  bestTone: z.string().optional(),
  bestFormat: z.string().optional(),
  bestCta: z.string().optional(),
});
