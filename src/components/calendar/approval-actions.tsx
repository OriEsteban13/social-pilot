"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Check, MessageSquareWarning, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideApprovalAction } from "@/app/(app)/w/[workspaceId]/actions";

export function ApprovalActions({ workspaceId, approvalId }: { workspaceId: string; approvalId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") {
    startTransition(async () => {
      await decideApprovalAction(workspaceId, approvalId, decision);
      toast.success(
        decision === "APPROVED" ? "Contenido aprobado y programado" : decision === "REJECTED" ? "Contenido rechazado" : "Cambios solicitados"
      );
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide("APPROVED")} disabled={isPending}>
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Aprobar
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide("CHANGES_REQUESTED")} disabled={isPending}>
        <MessageSquareWarning className="h-3.5 w-3.5" />
        Pedir cambios
      </Button>
      <Button size="sm" variant="ghost" onClick={() => decide("REJECTED")} disabled={isPending}>
        <X className="h-3.5 w-3.5" />
        Rechazar
      </Button>
    </div>
  );
}
