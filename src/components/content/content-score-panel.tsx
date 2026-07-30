import { cn } from "@/lib/utils";
import type { ContentScoreResult } from "@/server/ai/types";

const LABELS: Record<keyof ContentScoreResult["breakdown"], string> = {
  hook: "Hook",
  clarity: "Claridad",
  platformFit: "Adecuación a la red",
  brandConsistency: "Coherencia de marca",
  engagementPotential: "Potencial de interacción",
  cta: "CTA",
  length: "Longitud",
  originality: "Originalidad",
};

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function ContentScorePanel({ result }: { result: ContentScoreResult }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Content Score</span>
        <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold text-white", scoreColor(result.score))}>
          {result.score}/100
        </span>
      </div>
      <div className="space-y-1.5">
        {(Object.keys(result.breakdown) as (keyof ContentScoreResult["breakdown"])[]).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-36 shrink-0 text-xs text-muted-foreground">{LABELS[key]}</span>
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div className={cn("h-1.5 rounded-full", scoreColor(result.breakdown[key]))} style={{ width: `${result.breakdown[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
      {result.recommendations.length > 0 && (
        <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {result.recommendations.map((rec, i) => (
            <li key={i}>• {rec}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
