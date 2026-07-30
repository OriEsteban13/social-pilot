"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plug, Unplug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from "@/lib/enums";
import type { SocialPlatform } from "@/lib/enums";
import { connectAccountAction, disconnectAccountAction } from "@/app/(app)/w/[workspaceId]/accounts/actions";

export interface SocialAccountData {
  id: string;
  platform: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  connectedAt: Date | string | null;
}

export function AccountsBoard({
  workspaceId,
  accounts,
  usingMetricool,
}: {
  workspaceId: string;
  accounts: SocialAccountData[];
  usingMetricool: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));

  function connect(platform: SocialPlatform) {
    startTransition(async () => {
      try {
        await connectAccountAction(workspaceId, platform);
        toast.success(usingMetricool ? `${SOCIAL_PLATFORM_LABELS[platform]} sincronizado desde Metricool` : `${SOCIAL_PLATFORM_LABELS[platform]} conectado (modo simulado)`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se ha podido conectar la red.");
      }
    });
  }

  function disconnect(accountId: string) {
    startTransition(async () => {
      await disconnectAccountAction(workspaceId, accountId);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SOCIAL_PLATFORMS.map((platform) => {
        const account = byPlatform.get(platform);
        const connected = account?.status === "CONNECTED";
        return (
          <Card key={platform}>
            <CardHeader className="flex-row items-center gap-3">
              <PlatformBadge platform={platform} className="h-9 w-9 text-sm" />
              <div className="flex-1">
                <CardTitle className="text-base">{SOCIAL_PLATFORM_LABELS[platform]}</CardTitle>
                <p className="text-xs text-muted-foreground">{account?.handle ?? "No conectado"}</p>
              </div>
              <Badge variant={connected ? "secondary" : "outline"}>{connected ? "Conectado" : "Desconectado"}</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {usingMetricool ? "Vía Metricool (plan Advanced)" : "Adaptador simulado (sin credenciales oficiales — ver INTEGRATIONS.md)"}
              </p>
              {connected ? (
                <Button size="sm" variant="outline" onClick={() => disconnect(account!.id)} disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                  Desconectar
                </Button>
              ) : (
                <Button size="sm" onClick={() => connect(platform)} disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                  {usingMetricool ? "Sincronizar" : "Conectar"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
