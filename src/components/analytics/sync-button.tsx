"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAnalyticsAction } from "@/app/(app)/w/[workspaceId]/analytics/actions";

export function SyncButton({ workspaceId }: { workspaceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncAnalyticsAction(workspaceId);
          toast.success(`Métricas actualizadas (${result.syncedPosts} publicaciones)`);
          router.refresh();
        })
      }
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Sincronizar métricas
    </Button>
  );
}
