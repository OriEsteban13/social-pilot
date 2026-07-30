import { describe, expect, it } from "vitest";
import { encodeMetricoolId, decodeMetricoolId } from "@/server/integrations/metricool/client";
import { buildText, toPublicationDate, extractPostId, MetricoolAdapter } from "@/server/integrations/metricool/adapter";
import { PLATFORM_TO_METRICOOL_NETWORK } from "@/server/integrations/metricool/networks";

describe("Metricool id encoding", () => {
  it("round-trips a blogId and resourceId", () => {
    const encoded = encodeMetricoolId("4830123", "post_987");
    expect(decodeMetricoolId(encoded)).toEqual({ blogId: "4830123", resourceId: "post_987" });
  });

  it("supports a resourceId that itself contains colons", () => {
    const encoded = encodeMetricoolId("4830123", "linkedin:post:987");
    expect(decodeMetricoolId(encoded)).toEqual({ blogId: "4830123", resourceId: "linkedin:post:987" });
  });

  it("throws a clear error for a malformed id", () => {
    expect(() => decodeMetricoolId("not-a-metricool-id")).toThrow(/formato inesperado/);
    expect(() => decodeMetricoolId("mc:onlyblogid")).toThrow(/formato inesperado/);
  });
});

describe("PLATFORM_TO_METRICOOL_NETWORK", () => {
  it("maps X to Metricool's 'twitter' network name (not 'x')", () => {
    expect(PLATFORM_TO_METRICOOL_NETWORK.X).toBe("twitter");
  });

  it("maps every other platform to its lowercase name", () => {
    expect(PLATFORM_TO_METRICOOL_NETWORK.LINKEDIN).toBe("linkedin");
    expect(PLATFORM_TO_METRICOOL_NETWORK.INSTAGRAM).toBe("instagram");
    expect(PLATFORM_TO_METRICOOL_NETWORK.TIKTOK).toBe("tiktok");
    expect(PLATFORM_TO_METRICOOL_NETWORK.THREADS).toBe("threads");
  });
});

describe("buildText", () => {
  it("appends hashtags after a blank line when present", () => {
    expect(buildText("Hola mundo", ["#uno", "#dos"])).toBe("Hola mundo\n\n#uno #dos");
  });

  it("returns the body unchanged when there are no hashtags", () => {
    expect(buildText("Hola mundo", [])).toBe("Hola mundo");
  });
});

describe("toPublicationDate", () => {
  it("strips milliseconds and the trailing Z from the ISO date", () => {
    const date = new Date("2026-08-15T10:30:00.123Z");
    const result = toPublicationDate(date);
    expect(result.dateTime).toBe("2026-08-15T10:30:00");
  });

  it("defaults the timezone to Europe/Madrid when METRICOOL_TIMEZONE is unset", () => {
    delete process.env.METRICOOL_TIMEZONE;
    const result = toPublicationDate(new Date());
    expect(result.timezone).toBe("Europe/Madrid");
  });
});

describe("extractPostId", () => {
  it("reads a top-level 'id' field", () => {
    expect(extractPostId({ id: 12345 })).toBe("12345");
  });

  it("falls back to 'postId' when 'id' is absent", () => {
    expect(extractPostId({ postId: "abc" })).toBe("abc");
  });

  it("falls back to a nested 'data.id'", () => {
    expect(extractPostId({ data: { id: "nested-1" } })).toBe("nested-1");
  });

  it("throws a descriptive error when no id-like field is found", () => {
    expect(() => extractPostId({ foo: "bar" })).toThrow(/No se pudo extraer el id/);
  });
});

describe("MetricoolAdapter — rejects data: URIs before calling the API", () => {
  const accountRef = { externalAccountId: encodeMetricoolId("4830123", "linkedin") };
  const basePost = { accountRef, body: "Hola mundo", format: "POST", hashtags: [] as string[] };

  it("publishPost rejects a data: URI without making a network request", async () => {
    const adapter = new MetricoolAdapter("LINKEDIN");
    await expect(
      adapter.publishPost({ ...basePost, mediaUrls: ["data:image/png;base64,Zm9v"], idempotencyKey: "k1" })
    ).rejects.toThrow(/URLs públicas/);
  });

  it("publishPost passes through when media URLs are real http(s) URLs (fails later on missing credentials, not on the data: guard)", async () => {
    const adapter = new MetricoolAdapter("LINKEDIN");
    await expect(
      adapter.publishPost({ ...basePost, mediaUrls: ["https://v3.fal.media/files/foo.png"], idempotencyKey: "k2" })
    ).rejects.not.toThrow(/URLs públicas/);
  });

  it("schedulePost rejects a data: URI", async () => {
    const adapter = new MetricoolAdapter("INSTAGRAM");
    await expect(
      adapter.schedulePost({ ...basePost, mediaUrls: ["data:image/png;base64,Zm9v"], scheduledAt: new Date(), idempotencyKey: "k3" })
    ).rejects.toThrow(/URLs públicas/);
  });

  it("createPost rejects a data: URI", async () => {
    const adapter = new MetricoolAdapter("X");
    await expect(adapter.createPost({ ...basePost, mediaUrls: ["data:image/png;base64,Zm9v"] })).rejects.toThrow(/URLs públicas/);
  });
});
