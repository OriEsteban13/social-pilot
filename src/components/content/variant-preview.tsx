import { PlatformBadge } from "@/components/shared/platform-badge";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";

export function VariantPreview({
  platform,
  workspaceName,
  body,
  hashtags,
  mediaUrl,
  mediaType,
}: {
  platform: SocialPlatform;
  workspaceName: string;
  body: string;
  hashtags: string[];
  mediaUrl?: string;
  mediaType?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {workspaceName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{workspaceName}</p>
          <p className="text-[11px] text-muted-foreground">{SOCIAL_PLATFORM_LABELS[platform]} · ahora</p>
        </div>
        <PlatformBadge platform={platform} />
      </div>

      {mediaUrl ? (
        mediaType === "VIDEO" ? (
          <video src={mediaUrl} controls className="aspect-square w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="Vista previa del contenido" className="aspect-square w-full object-cover" />
        )
      ) : null}

      <div className="space-y-2 p-3">
        <p className="whitespace-pre-line text-sm leading-snug">{body || <span className="text-muted-foreground">Sin contenido todavía.</span>}</p>
        {hashtags.length > 0 && (
          <p className="text-xs text-sky-600">{hashtags.join(" ")}</p>
        )}
      </div>
    </div>
  );
}
