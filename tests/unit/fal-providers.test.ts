import { afterEach, describe, expect, it } from "vitest";
import { buildPrompt as buildImagePrompt, DIMENSIONS } from "@/server/media/providers/fal-image";
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
    expect(prompt).toContain("Camaleonic Survey");
    expect(prompt).toContain("#6366f1");
  });

  it("omits the headline instruction when no headline is given", () => {
    const prompt = buildImagePrompt({
      prompt: "encuestas con IA",
      aspectRatio: "1:1",
      brandName: "Camaleonic Survey",
      brandColors: ["#6366f1"],
    });
    expect(prompt).not.toContain("titular");
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
