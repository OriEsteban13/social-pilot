import { cn } from "@/lib/utils";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";

const PLATFORM_STYLE: Record<SocialPlatform, { code: string; className: string }> = {
  LINKEDIN: { code: "in", className: "bg-[#0A66C2] text-white" },
  INSTAGRAM: { code: "IG", className: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white" },
  TIKTOK: { code: "TT", className: "bg-black text-white" },
  THREADS: { code: "@", className: "bg-neutral-800 text-white" },
  X: { code: "X", className: "bg-black text-white" },
};

export function PlatformBadge({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const style = PLATFORM_STYLE[platform];
  return (
    <span
      title={SOCIAL_PLATFORM_LABELS[platform]}
      className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold", style.className, className)}
    >
      {style.code}
    </span>
  );
}
