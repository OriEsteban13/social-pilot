import { afterEach, describe, expect, it, vi } from "vitest";
import { mapAspectRatioToSize } from "@/server/media/providers/openai-image";

describe("mapAspectRatioToSize", () => {
  it("maps 1:1 to a square size", () => {
    expect(mapAspectRatioToSize("1:1")).toEqual({ api: "1024x1024", width: 1024, height: 1024 });
  });

  it("maps portrait ratios (4:5, 9:16) to the same supported portrait size", () => {
    expect(mapAspectRatioToSize("4:5")).toEqual({ api: "1024x1536", width: 1024, height: 1536 });
    expect(mapAspectRatioToSize("9:16")).toEqual({ api: "1024x1536", width: 1024, height: 1536 });
  });

  it("maps landscape ratios (16:9, 1.91:1) to the same supported landscape size", () => {
    expect(mapAspectRatioToSize("16:9")).toEqual({ api: "1536x1024", width: 1536, height: 1024 });
    expect(mapAspectRatioToSize("1.91:1")).toEqual({ api: "1536x1024", width: 1536, height: 1024 });
  });
});

describe("OpenAIImageProvider.generateImage — Metricool-compatibility branching", () => {
  const baseInput = {
    prompt: "encuestas con IA",
    aspectRatio: "1:1" as const,
    brandName: "Camaleonic Survey",
    brandColors: ["#6366f1"],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("@/server/storage/supabase-storage");
    delete process.env.OPENAI_API_KEY;
  });

  function mockOpenAIFetch(data: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [data] }),
      } as Response)
    );
  }

  it("uses the response 'url' directly when OpenAI provides one", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAIFetch({ url: "https://files.openai.com/generated.png" });
    const { OpenAIImageProvider } = await import("@/server/media/providers/openai-image");
    const image = await new OpenAIImageProvider().generateImage(baseInput);
    expect(image.url).toBe("https://files.openai.com/generated.png");
  });

  it("falls back to a data: URI when b64_json is returned and Supabase Storage isn't configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockOpenAIFetch({ b64_json: "Zm9v" });
    const { OpenAIImageProvider } = await import("@/server/media/providers/openai-image");
    const image = await new OpenAIImageProvider().generateImage(baseInput);
    expect(image.url).toBe("data:image/png;base64,Zm9v");
  });

  it("uploads to Supabase Storage and returns a public URL when b64_json is returned and Storage is configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAIFetch({ b64_json: "Zm9v" });
    vi.doMock("@/server/storage/supabase-storage", () => ({
      isSupabaseStorageConfigured: () => true,
      uploadPublicAsset: vi.fn().mockResolvedValue("https://project.supabase.co/storage/v1/object/public/media/openai-images/foo.png"),
    }));
    const { OpenAIImageProvider } = await import("@/server/media/providers/openai-image");
    const image = await new OpenAIImageProvider().generateImage(baseInput);
    expect(image.url).toBe("https://project.supabase.co/storage/v1/object/public/media/openai-images/foo.png");
    expect(image.url.startsWith("data:")).toBe(false);
  });
});
