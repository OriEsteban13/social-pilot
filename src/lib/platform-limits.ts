import type { SocialPlatform } from "./enums";

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  LINKEDIN: 3000,
  INSTAGRAM: 2200,
  TIKTOK: 150,
  THREADS: 500,
  X: 280,
};
