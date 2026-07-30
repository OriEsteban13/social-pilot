import { afterEach, describe, expect, it } from "vitest";
import { isSupabaseStorageConfigured } from "@/server/storage/supabase-storage";

describe("isSupabaseStorageConfigured", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns false when neither variable is set", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isSupabaseStorageConfigured()).toBe(false);
  });

  it("returns false when only the URL is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isSupabaseStorageConfigured()).toBe(false);
  });

  it("returns false when only the service role key is set", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    expect(isSupabaseStorageConfigured()).toBe(false);
  });

  it("returns true when both variables are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    expect(isSupabaseStorageConfigured()).toBe(true);
  });
});
