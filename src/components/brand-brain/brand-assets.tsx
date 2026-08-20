"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2, Plus, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_ASSET_TYPES } from "@/lib/enums";
import type { BrandAssetType } from "@/lib/enums";
import { addBrandAssetAction, uploadBrandAssetFileAction } from "@/app/(app)/w/[workspaceId]/brand-brain/actions";

export interface BrandAssetData {
  id: string;
  type: string;
  name: string;
  url: string;
}

const TYPE_LABEL: Record<BrandAssetType, string> = {
  LOGO: "Logotipo",
  BRAND_BOOK: "Manual de marca",
  COLOR_PALETTE: "Paleta de colores",
  FONT: "Tipografía",
  EXAMPLE_POST: "Ejemplo de publicación",
  PRESENTATION: "Presentación",
  OTHER: "Otro",
};

export function BrandAssets({
  workspaceId,
  assets,
  storageConfigured,
}: {
  workspaceId: string;
  assets: BrandAssetData[];
  storageConfigured: boolean;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<BrandAssetType>("LOGO");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function add() {
    if (!name.trim() || !url.trim()) return;
    startTransition(async () => {
      await addBrandAssetAction(workspaceId, type, name, url);
      setName("");
      setUrl("");
      toast.success("Activo añadido a la biblioteca de marca");
      router.refresh();
    });
  }

  function uploadFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadBrandAssetFileAction(workspaceId, type, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Archivo subido a la biblioteca de marca");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Activos de marca
        </CardTitle>
        <CardDescription>
          Logo, manual de marca, presentaciones y ejemplos de publicaciones.
          {storageConfigured
            ? " Sube el archivo directamente, o pega la URL de uno ya alojado en otro sitio (Drive, tu web...)."
            : " La subida directa no está disponible (falta configurar Supabase Storage) — añade la URL pública del archivo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={type} onValueChange={(v) => setType(v as BrandAssetType)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_ASSET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {storageConfigured && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Subir archivo
              </Button>
              <span className="text-xs text-muted-foreground">o pega una URL:</span>
            </>
          )}
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="URL del archivo" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={add} disabled={isPending || !name.trim() || !url.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((asset) => (
            <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="rounded-lg border p-3 text-sm hover:bg-muted/50">
              {asset.type === "LOGO" && /\.(png|jpe?g|svg|webp|gif)$/i.test(asset.url) ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa/Supabase Storage, no una imagen local optimizable
                <img src={asset.url} alt={asset.name} className="mb-2 h-12 w-full rounded object-contain" />
              ) : null}
              <p className="truncate font-medium">{asset.name}</p>
              <p className="text-xs text-muted-foreground">{TYPE_LABEL[asset.type as BrandAssetType] ?? asset.type}</p>
            </a>
          ))}
          {assets.length === 0 && <p className="text-sm text-muted-foreground">Sin activos todavía.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
