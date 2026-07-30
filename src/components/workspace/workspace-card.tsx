import Link from "next/link";
import { Card } from "@/components/ui/card";
import { WorkspaceStatusBadge } from "./status-badge";
import { ROLE_LABELS } from "@/lib/enums";
import type { Role } from "@/lib/enums";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const GRADIENTS = [
  "from-indigo-500 to-sky-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-violet-500 to-purple-500",
];

export function WorkspaceCard({
  workspace,
  status,
}: {
  workspace: { id: string; name: string; industry: string | null; role: Role };
  status: { label: string; tone: string };
}) {
  const gradient = GRADIENTS[Math.abs(hash(workspace.id)) % GRADIENTS.length];

  return (
    <Link href={`/w/${workspace.id}`} className="group block">
      <Card className="h-full gap-4 p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-semibold text-white`}
          >
            {initials(workspace.name)}
          </div>
          <WorkspaceStatusBadge label={status.label} tone={status.tone} />
        </div>
        <div>
          <h3 className="font-semibold leading-tight group-hover:underline">{workspace.name}</h3>
          <p className="text-sm text-muted-foreground">{workspace.industry ?? "Sin sector definido"}</p>
        </div>
        <p className="text-xs text-muted-foreground">Tu rol: {ROLE_LABELS[workspace.role]}</p>
      </Card>
    </Link>
  );
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return h;
}
