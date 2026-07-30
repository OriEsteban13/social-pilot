"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importIdeasFromFileAction } from "@/app/(app)/w/[workspaceId]/create/actions";

export function ImportIdeasDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function importFile() {
    if (!file) {
      toast.error("Elige primero un archivo .csv o .xlsx.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await importIdeasFromFileAction(workspaceId, formData);

      result.errors.slice(0, 5).forEach((err) => toast.warning(err));

      if (result.created > 0) {
        toast.success(`${result.created} idea${result.created === 1 ? "" : "s"} importada${result.created === 1 ? "" : "s"}. Revísalas en Ideas.`);
        setOpen(false);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.push(`/w/${workspaceId}/ideas`);
      } else if (result.errors.length === 0) {
        toast.error("El archivo no contenía filas válidas.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" />
          Importar desde CSV/Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar ideas desde CSV/Excel</DialogTitle>
          <DialogDescription>
            Sube tus propias ideas de publicaciones (título, red, pilar…). Se guardan como ideas listas para revisar y
            convertir en la sección Ideas — este paso no genera contenido con IA.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <a href={`/w/${workspaceId}/create/template`} download>
            <Button type="button" variant="secondary" className="w-full">
              <Download className="h-4 w-4" />
              Descargar plantilla (.xlsx)
            </Button>
          </a>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
            <FileSpreadsheet className="h-6 w-6" />
            {file ? file.name : "Haz clic para elegir un archivo .csv o .xlsx (máx. 200 filas)"}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={importFile} disabled={isPending || !file}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isPending ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
