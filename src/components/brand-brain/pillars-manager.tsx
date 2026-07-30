"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addPillarAction, deletePillarAction } from "@/app/(app)/w/[workspaceId]/brand-brain/actions";

export interface PillarData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

export function PillarsManager({ workspaceId, pillars }: { workspaceId: string; pillars: PillarData[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addPillarAction(workspaceId, name, description || undefined);
      setName("");
      setDescription("");
      toast.success("Pilar añadido");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deletePillarAction(workspaceId, id);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilares de contenido</CardTitle>
        <CardDescription>Los ejes temáticos que la IA usa para generar ideas y mantener el equilibrio editorial.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {pillars.map((pillar) => (
            <Badge key={pillar.id} variant="outline" className="gap-1.5 py-1.5 pl-3 pr-1.5" style={{ borderColor: pillar.color ?? undefined }}>
              {pillar.name}
              <button onClick={() => remove(pillar.id)} disabled={isPending} className="rounded-full p-0.5 hover:bg-muted">
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {pillars.length === 0 && <p className="text-sm text-muted-foreground">Sin pilares todavía.</p>}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nombre del pilar" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={add} disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
