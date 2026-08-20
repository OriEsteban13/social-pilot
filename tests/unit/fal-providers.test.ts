import { afterEach, describe, expect, it } from "vitest";
import { buildPrompt as buildImagePrompt, describeColor, DIMENSIONS } from "@/server/media/providers/fal-image";
import {
  buildPrompt as buildVideoPrompt,
  getModelKey,
  MODELS,
  nearestSupportedDuration,
} from "@/server/media/providers/fal-video";

describe("FalImageProvider — buildPrompt", () => {
  it("includes the headline instruction when a headline is given", () => {
    const prompt = buildImagePrompt({
      prompt: "encuestas con IA",
      aspectRatio: "1:1",
      headline: "Nuevo panel de analítica",
      brandName: "Camaleonic Survey",
      brandColors: ["#6366f1", "#10b981"],
    });
    expect(prompt).toContain("Nuevo panel de analítica");
    expect(prompt.toLowerCase()).toContain("azul"); // #6366f1 descrito en lenguaje natural, no como hex
  });

  it("never mentions the brand name in the prompt (regression: naming it made the model draw a logo and misspell it)", () => {
    const prompt = buildImagePrompt({
      prompt: "encuestas con IA",
      aspectRatio: "1:1",
      headline: "Nuevo panel de analítica",
      brandName: "Camaleonic Survey",
      brandColors: ["#6366f1", "#10b981"],
    });
    expect(prompt).not.toContain("Camaleonic Survey");
  });

  it("omits the headline instruction when no headline is given (the generic style guidance may still mention 'titular' typography)", () => {
    const prompt = buildImagePrompt({
      prompt: "encuestas con IA",
      aspectRatio: "1:1",
      brandName: "Camaleonic Survey",
      brandColors: ["#6366f1"],
    });
    expect(prompt).not.toContain("Incluye el titular");
  });

  it("describes brand colors in natural language instead of raw hex codes (regression: Recraft rendered hex codes as literal text on the image)", () => {
    const prompt = buildImagePrompt({
      prompt: "encuestas con IA",
      aspectRatio: "1:1",
      brandName: "Camaleonic Survey",
      brandColors: ["#1f3a2e", "#de6b3f"],
    });
    expect(prompt).not.toContain("#1f3a2e");
    expect(prompt).not.toContain("#de6b3f");
    expect(prompt.toLowerCase()).toContain("verde");
  });
});

describe("describeColor", () => {
  it("classifies a near-white cream as 'blanco roto', not a pastel hue (regression: HSL saturation formula misfires near lightness=1)", () => {
    expect(describeColor("#f3f1ea")).toBe("blanco roto");
    expect(describeColor("#ffffff")).toBe("blanco roto");
  });

  it("classifies a dark forest green correctly", () => {
    expect(describeColor("#1f3a2e")).toContain("verde");
  });

  it("classifies a terracotta/orange tone as an orange family, not literally re-emitting the hex", () => {
    const description = describeColor("#de6b3f");
    expect(description).not.toContain("#");
    expect(description).toMatch(/naranja|terracota/);
  });

  it("classifies near-black as a dark neutral", () => {
    expect(describeColor("#000000")).toContain("oscuro");
  });

  it("returns the input unchanged for a malformed hex", () => {
    expect(describeColor("not-a-color")).toBe("not-a-color");
  });
});

describe("FalImageProvider — DIMENSIONS", () => {
  it("defines pixel dimensions for every supported aspect ratio", () => {
    expect(DIMENSIONS["1:1"]).toEqual({ width: 1080, height: 1080 });
    expect(DIMENSIONS["9:16"].height).toBeGreaterThan(DIMENSIONS["9:16"].width);
    expect(DIMENSIONS["16:9"].width).toBeGreaterThan(DIMENSIONS["16:9"].height);
  });
});

describe("FalVideoProvider — getModelKey", () => {
  afterEach(() => {
    delete process.env.FAL_VIDEO_MODEL;
  });

  it("defaults to kling when FAL_VIDEO_MODEL is unset", () => {
    delete process.env.FAL_VIDEO_MODEL;
    expect(getModelKey()).toBe("kling");
  });

  it("uses wan when explicitly configured", () => {
    process.env.FAL_VIDEO_MODEL = "wan";
    expect(getModelKey()).toBe("wan");
  });

  it("falls back to kling for any unrecognized value", () => {
    process.env.FAL_VIDEO_MODEL = "something-else";
    expect(getModelKey()).toBe("kling");
  });
});

describe("FalVideoProvider — MODELS", () => {
  it("maps both keys to a fal.ai model id", () => {
    expect(MODELS.kling).toBe("fal-ai/kling-video/v2.1/master/text-to-video");
    expect(MODELS.wan).toBe("fal-ai/wan-25-preview/text-to-video");
  });
});

describe("nearestSupportedDuration", () => {
  it("rounds down to 5 for short durations", () => {
    expect(nearestSupportedDuration(5)).toBe("5");
    expect(nearestSupportedDuration(7)).toBe("5");
  });

  it("rounds up to 10 for longer durations", () => {
    expect(nearestSupportedDuration(8)).toBe("10");
    expect(nearestSupportedDuration(15)).toBe("10");
  });
});

describe("FalVideoProvider — buildPrompt", () => {
  it("combines the brief with brand name and colors", () => {
    const prompt = buildVideoPrompt({
      brief: "Lanzamiento del nuevo dashboard",
      brandName: "Camaleonic Survey",
      brandColors: ["#6366f1", "#10b981"],
      durationSeconds: 8,
      aspectRatio: "9:16",
    });
    expect(prompt).toContain("Lanzamiento del nuevo dashboard");
    expect(prompt).toContain("Camaleonic Survey");
    expect(prompt).toContain("#6366f1");
  });
});
