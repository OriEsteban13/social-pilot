"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createCampaignAction, updateCampaignStatusAction } from "@/app/(app)/w/[workspaceId]/campaigns/actions";

export interface CampaignData {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  _count: { contentItems: number };
}

export function CampaignsBoard({ workspaceId, campaigns }: { workspaceId: string; campaigns: CampaignData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createCampaignAction(workspaceId, name, goal || undefined);
      setOpen(false);
      setName("");
      setGoal("");
      toast.success("Campaña creada");
      router.refresh();
    });
  }

  function cycleStatus(campaign: CampaignData) {
    const next = campaign.status === "ACTIVE" ? "PAUSED" : campaign.status === "PAUSED" ? "FINISHED" : "ACTIVE";
    startTransition(async () => {
      await updateCampaignStatusAction(workspaceId, campaign.id, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nueva campaña
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva campaña</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nombre de la campaña" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Objetivo (opcional)" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={create} disabled={isPending || !name.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <Flag className="mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no hay campañas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle className="text-base">{campaign.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{campaign.goal ?? "Sin objetivo definido"}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{campaign._count.contentItems} publicaciones</Badge>
                  <Button size="sm" variant="ghost" onClick={() => cycleStatus(campaign)} disabled={isPending}>
                    {campaign.status}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
