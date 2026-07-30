import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/client";
import type { Role } from "@/lib/enums";

/**
 * Sesión firmada por cookie (HMAC-SHA256), sin dependencias externas.
 * Cubre "registro e inicio de sesión" en local sin credenciales de Supabase.
 * En producción se sustituye por Supabase Auth (cookies gestionadas por su
 * SDK) — ver ARCHITECTURE.md.
 */

const SESSION_COOKIE = "csp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
}

function sign(userId: string): string {
  const signature = createHmac("sha256", getSecret()).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

function verify(token: string): string | null {
  const [userId, signature] = token.split(".");
  if (!userId || !signature) return null;
  const expected = createHmac("sha256", getSecret()).update(userId).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  return userId;
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getMembership(userId: string, workspaceId: string) {
  return prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
}

export async function requireWorkspaceAccess(userId: string, workspaceId: string, roles?: Role[]) {
  const membership = await getMembership(userId, workspaceId);
  if (!membership) redirect("/");
  if (roles && !roles.includes(membership.role as Role)) {
    throw new Error(`Acción no permitida para el rol ${membership.role}.`);
  }
  return membership;
}
