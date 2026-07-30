import type { Prisma } from "@/generated/prisma/client";

/**
 * Helpers para trabajar con los campos `Json` de Prisma (usados en SQLite en
 * lugar de listas escalares nativas, ver prisma/schema.prisma). Centralizan
 * el parseo defensivo: si el dato viniera corrupto o vacío, se degrada a un
 * array/objeto vacío en lugar de lanzar una excepción en la UI.
 */

export function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function toJsonArray<T = unknown>(value: Prisma.JsonValue | null | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

export function toJsonRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: Prisma.JsonValue | null | undefined
): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as T;
  return value as T;
}

export function jsonArray<T>(items: T[]): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue;
}

export function jsonRecord<T extends Record<string, unknown>>(obj: T): Prisma.InputJsonValue {
  return obj as unknown as Prisma.InputJsonValue;
}
