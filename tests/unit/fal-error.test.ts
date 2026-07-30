import { describe, expect, it } from "vitest";
import { describeFalError } from "@/server/media/providers/fal-error";

describe("describeFalError", () => {
  it("extracts the detail field from a fal.ai ApiError-shaped object", () => {
    const error = { status: 403, message: "Forbidden", body: { detail: "User is locked. Reason: Exhausted balance." } };
    expect(describeFalError(error)).toBe("User is locked. Reason: Exhausted balance.");
  });

  it("falls back to the Error message when there's no body.detail", () => {
    expect(describeFalError(new Error("network down"))).toBe("network down");
  });

  it("falls back to a generic message for a non-Error, non-ApiError value", () => {
    expect(describeFalError("plain string")).toBe("error desconocido");
  });

  it("falls back when body exists but detail isn't a string", () => {
    const error = { body: { detail: { nested: true } } };
    expect(describeFalError(error)).toBe("error desconocido");
  });
});
