"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateMetricoolBlogIdAction } from "@/app/(app)/w/[workspaceId]/settings/actions";

export function MetricoolSettingsForm({
  workspaceId,
  initialBlogId,
  socialProviderIsMetricool,
}: {
  workspaceId: string;
  initialBlogId: string;
  socialProviderIsMetricool: boolean;
}) {
  const [blogId, setBlogId] = useState(initialBlogId);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      await updateMetricoolBlogIdAction(workspaceId, blogId);
      toast.success("Brand ID de Metricool guardado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Metricool</CardTitle>
          <Badge variant={socialProviderIsMetricool ? "secondary" : "outline"}>
            {socialProviderIsMetricool ? "Activo" : "Inactivo (SOCIAL_PROVIDER=simulated)"}
          </Badge>
        </div>
        <CardDescription>
          La publicación real en las 5 redes se hace a través de tu cuenta de Metricool (plan Advanced). Conecta cada
          red directamente en{" "}
          <a href="https://app.metricool.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
            app.metricool.com
          </a>{" "}
          y pega aquí el Brand ID (blogId) de la marca que corresponde a esta empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="metricool-blog-id">Brand ID de Metricool (blogId)</Label>
          <Input
            id="metricool-blog-id"
            value={blogId}
            onChange={(e) => setBlogId(e.target.value)}
            placeholder="p.ej. 4830123"
          />
          <p className="text-xs text-muted-foreground">
            Lo encuentras en la URL de Metricool al entrar en esta marca (app.metricool.com/dashboard?blogId=...) o vía
            `metricool brands` en su API.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={isPending || blogId === initialBlogId}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
