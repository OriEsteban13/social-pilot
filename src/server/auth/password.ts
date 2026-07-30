import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Hash de contraseñas con scrypt (nativo de Node, sin dependencias extra).
 * Solo se usa en el modo "demo auth" local — ver ARCHITECTURE.md, sección de
 * seguridad. En producción, la autenticación la gestiona Supabase Auth y
 * este módulo deja de intervenir.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
}
