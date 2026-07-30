import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Cifrado simétrico (AES-256-GCM) para tokens de integración en reposo.
 * Nunca se almacenan tokens sin cifrar (ver ARCHITECTURE.md, sección
 * Seguridad). La clave se deriva de `TOKEN_ENCRYPTION_KEY`; en desarrollo se
 * usa un valor por defecto para no bloquear el arranque, pero debe
 * sustituirse por un secreto real antes de desplegar a producción.
 */

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? "dev-only-insecure-key-change-me";
  return scryptSync(secret, "camaleonic-social-pilot", 32);
}

export function encryptToken(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("Token cifrado con formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
