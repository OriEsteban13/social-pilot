import { describe, expect, it } from "vitest";
import { hashSeed, pick } from "@/lib/seeded-pick";

describe("pick", () => {
  it("normalizes negative seeds into a valid array index instead of returning undefined", () => {
    const arr = ["a", "b", "c", "d", "e"];
    expect(pick(arr, -3)).toBe(arr[2]);
    expect(pick(arr, -1)).toBe(arr[4]);
  });

  it("throws for an empty array", () => {
    expect(() => pick([], 5)).toThrow(/empty array/);
  });
});

describe("hashSeed", () => {
  it("produces different high bits for inputs that differ only in a trailing counter (regression: used to repeat for dozens of increments)", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => hashSeed(`Acme-manual-BLOG_ARTICLE-${i + 1}`) >> 8);
    const unique = new Set(seeds);
    // Con el hash sin mezclar, esto colapsaba a 1-2 valores distintos.
    expect(unique.size).toBeGreaterThan(10);
  });

  it("is deterministic for the same input", () => {
    expect(hashSeed("hola mundo")).toBe(hashSeed("hola mundo"));
  });

  it("always returns a non-negative 32-bit integer", () => {
    for (const input of ["a", "abc", "a much longer string with spaces and ñ"]) {
      const h = hashSeed(input);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});
