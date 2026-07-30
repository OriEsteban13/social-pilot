import { describe, expect, it } from "vitest";
import { slugify } from "@/server/services/workspace";

describe("slugify", () => {
  it("lowercases and hyphenates a normal name", () => {
    expect(slugify("Camaleonic Survey")).toBe("camaleonic-survey");
  });

  it("strips accents", () => {
    expect(slugify("Automatización y análisis")).toBe("automatizacion-y-analisis");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("MIC Football!! 2026 -- Edición")).toBe("mic-football-2026-edicion");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Reto Pelayo--  ")).toBe("reto-pelayo");
  });
});
