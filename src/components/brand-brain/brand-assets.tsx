"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_ASSET_TYPES } from "@/lib/enums";
import type { BrandAssetType } from "@/lib/enums";
import { addBrandAssetAction } from "@/app/(app)/w/[workspaceId]/brand-brain/actions";

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

export function BrandAssets({ workspaceId, assets }: { workspaceId: string; assets: BrandAssetData[] }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<BrandAssetType>("LOGO");
  const [isPending, startTransition] = useTransition();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Activos de marca
        </CardTitle>
        <CardDescription>
          Logo, manual de marca, presentaciones y ejemplos de publicaciones. Sin Supabase Storage configurado, añade
          la URL pública del archivo (por ejemplo, un enlace a Drive o a tu web).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="URL del archivo" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as BrandAssetType)}>
            <SelectTrigger className="w-40">
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
          <Button onClick={add} disabled={isPending || !name.trim() || !url.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((asset) => (
            <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="rounded-lg border p-3 text-sm hover:bg-muted/50">
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
