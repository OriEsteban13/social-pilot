import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips a plaintext token", () => {
    const encrypted = encryptToken("sim_token_abc123");
    expect(encrypted).not.toContain("sim_token_abc123");
    expect(decryptToken(encrypted)).toBe("sim_token_abc123");
  });

  it("never stores the plaintext token in the encrypted payload", () => {
    const secret = "super-secret-access-token-value";
    const encrypted = encryptToken(secret);
    expect(encrypted.includes(secret)).toBe(false);
  });

  it("throws on a tampered payload instead of silently returning garbage", () => {
    const encrypted = encryptToken("sim_token_abc123");
    const [iv, authTag, data] = encrypted.split(":");
    const tampered = [iv, authTag, data.slice(0, -2) + "00"].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
