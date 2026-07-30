import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<string, string> = {
  autopilot: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  manual: "bg-muted text-muted-foreground border-transparent",
  assisted: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20",
};

export function WorkspaceStatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASSES[tone] ?? TONE_CLASSES.manual)}>
      {label}
    </Badge>
  );
}
