import { describe, expect, it } from "vitest";
import { SimulatedAdapter } from "@/server/integrations/simulated-adapter";

describe("SimulatedAdapter", () => {
  it("is flagged as simulated for every platform", () => {
    const adapter = new SimulatedAdapter("LINKEDIN");
    expect(adapter.simulated).toBe(true);
  });

  it("publishPost returns a well-formed, platform-specific URL", async () => {
    const adapter = new SimulatedAdapter("INSTAGRAM");
    const result = await adapter.publishPost({
      accountRef: { externalAccountId: "acc_1" },
      body: "Hola mundo",
      mediaUrls: [],
      format: "POST",
      hashtags: [],
      idempotencyKey: "key-1",
    });

    expect(result.simulated).toBe(true);
    expect(result.externalUrl).toContain("instagram.com");
    expect(result.externalId).toMatch(/^sim_post_/);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it("fetchAnalytics returns internally consistent, non-negative metrics", async () => {
    const adapter = new SimulatedAdapter("TIKTOK");
    const [metrics] = await adapter.fetchAnalytics({ externalId: "sim_post_x" });

    expect(metrics.impressions).toBeGreaterThan(0);
    expect(metrics.reach ?? 0).toBeLessThanOrEqual(metrics.impressions ?? 0);
    expect(metrics.videoViews).toBeDefined();
  });

  it("connectAccount returns usable, non-empty credentials", async () => {
    const adapter = new SimulatedAdapter("X");
    const account = await adapter.connectAccount({ workspaceId: "ws_1" });

    expect(account.externalAccountId).toMatch(/^sim_acct_/);
    expect(account.accessToken.length).toBeGreaterThan(0);
    expect(account.scopes.length).toBeGreaterThan(0);
  });
});
