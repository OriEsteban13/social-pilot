import { CalendarCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "./approval-actions";
import type { listPendingApprovals } from "@/server/services/approvals";

const SCOPE_LABEL: Record<string, string> = { ITEM: "publicación", WEEK: "la semana", MONTH: "el mes" };

export async function ApprovalsBanner({
  workspaceId,
  approvals,
}: {
  workspaceId: string;
  approvals: Awaited<ReturnType<typeof listPendingApprovals>>;
}) {
  return (
    <div className="space-y-2 border-b bg-amber-500/5 p-4">
      {approvals.map((approval) => (
        <Card key={approval.id} className="border-amber-500/30 py-3">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2 text-sm">
              <CalendarCheck2 className="h-4 w-4 text-amber-600" />
              <span>
                Contenido de <strong>{SCOPE_LABEL[approval.scope] ?? approval.scope.toLowerCase()}</strong> listo para
                revisar
              </span>
              <Badge variant="outline">{approval.targets.length} publicaciones</Badge>
            </div>
            <ApprovalActions workspaceId={workspaceId} approvalId={approval.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
