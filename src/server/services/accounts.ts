import { prisma } from "@/server/db/client";
import { getSocialAdapter } from "@/server/integrations/registry";
import { encryptToken } from "@/lib/crypto";
import { jsonArray } from "@/lib/json";
import { logAudit } from "./audit";
import type { SocialPlatform } from "@/lib/enums";

export async function listSocialAccounts(workspaceId: string) {
  return prisma.socialAccount.findMany({ where: { workspaceId }, orderBy: { platform: "asc" } });
}

export async function connectSocialAccount(workspaceId: string, platform: SocialPlatform, userId?: string) {
  const adapter = getSocialAdapter(platform);
  const ref = await adapter.connectAccount({ workspaceId });

  const account = await prisma.socialAccount.upsert({
    where: { workspaceId_platform_externalAccountId: { workspaceId, platform, externalAccountId: ref.externalAccountId } },
    create: {
      workspaceId,
      platform,
      externalAccountId: ref.externalAccountId,
      handle: ref.handle,
      displayName: ref.displayName,
      status: "CONNECTED",
      connectedAt: new Date(),
    },
    update: { status: "CONNECTED", connectedAt: new Date() },
  });

  await prisma.integrationToken.upsert({
    where: { socialAccountId: account.id },
    create: {
      socialAccountId: account.id,
      accessTokenEncrypted: encryptToken(ref.accessToken),
      refreshTokenEncrypted: ref.refreshToken ? encryptToken(ref.refreshToken) : undefined,
      expiresAt: ref.expiresAt,
      scopes: jsonArray(ref.scopes),
    },
    update: {
      accessTokenEncrypted: encryptToken(ref.accessToken),
      refreshTokenEncrypted: ref.refreshToken ? encryptToken(ref.refreshToken) : undefined,
      expiresAt: ref.expiresAt,
      scopes: jsonArray(ref.scopes),
    },
  });

  await logAudit({
    workspaceId,
    userId,
    action: "social_account.connected",
    entityType: "SocialAccount",
    entityId: account.id,
    metadata: { platform, simulated: adapter.simulated },
  });

  return account;
}

export async function disconnectSocialAccount(accountId: string, userId?: string) {
  const account = await prisma.socialAccount.update({ where: { id: accountId }, data: { status: "DISCONNECTED" } });
  await logAudit({
    workspaceId: account.workspaceId,
    userId,
    action: "social_account.disconnected",
    entityType: "SocialAccount",
    entityId: accountId,
  });
  return account;
}

/**
 * Devuelve la cuenta conectada para la plataforma, o la aprovisiona
 * automáticamente (vía adaptador simulado) si el workspace todavía no ha
 * pasado por el paso de "Redes conectadas". Evita que programar contenido
 * falle solo por no haber completado ese paso del onboarding.
 */
export async function ensureAccountForPlatform(workspaceId: string, platform: SocialPlatform) {
  const existing = await prisma.socialAccount.findFirst({ where: { workspaceId, platform, status: "CONNECTED" } });
  if (existing) return existing;
  return connectSocialAccount(workspaceId, platform);
}
