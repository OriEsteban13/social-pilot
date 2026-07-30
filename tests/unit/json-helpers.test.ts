import { describe, expect, it } from "vitest";
import { toStringArray, toJsonRecord } from "@/lib/json";

describe("json helpers", () => {
  it("returns an empty array for null/undefined", () => {
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray(undefined)).toEqual([]);
  });

  it("returns an empty array when the value is not an array", () => {
    expect(toStringArray("not-an-array")).toEqual([]);
    expect(toStringArray({ a: 1 })).toEqual([]);
  });

  it("filters out non-string entries from a mixed array", () => {
    expect(toStringArray(["a", 1, "b", null, "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty object for null, arrays, or non-object values", () => {
    expect(toJsonRecord(null)).toEqual({});
    expect(toJsonRecord([1, 2, 3])).toEqual({});
    expect(toJsonRecord("x")).toEqual({});
  });

  it("passes through a valid JSON object unchanged", () => {
    expect(toJsonRecord({ foo: "bar" })).toEqual({ foo: "bar" });
  });
});
