"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createBlogArticleAction } from "@/app/(app)/w/[workspaceId]/blog/actions";

export function NewBlogArticleButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      await createBlogArticleAction(workspaceId, title.trim() || "Nuevo artículo");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" />
          Nuevo artículo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo artículo de blog</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-article-title">Título o tema</Label>
          <Input
            id="new-article-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="p.ej. Cómo elegir el mejor software de encuestas para tu empresa"
          />
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
