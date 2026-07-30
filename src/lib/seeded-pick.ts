/**
 * Selección determinista "aleatoria" a partir de una cadena — usada por los
 * proveedores mock (ideas, copy, imágenes) para variar la salida según el
 * contenido sin depender de ningún generador de números aleatorios real.
 */

export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  // Los inputs de este módulo suelen diferir solo en el último carácter
  // (p.ej. "...-1" vs "...-2" según el número de intento), y el hash
  // polinómico de arriba por sí solo no difunde bien un cambio tan pequeño
  // hacia los bits altos — un `pick(arr, seed >> 8)` podía devolver el mismo
  // resultado para decenas de intentos seguidos. Se aplica el finalizador de
  // Murmur3 (mezcla completa de bits) para que un cambio de 1 en el input
  // cambie también los bits altos de la salida.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function pick<T>(arr: T[], seed: number): T {
  if (arr.length === 0) throw new Error("pick() called with empty array");
  // `seed` suele venir de desplazamientos de bits (seed >> n) sobre un hash de
  // 32 bits sin signo; si el hash supera 2^31-1, `>>` lo reinterpreta como
  // negativo, y el operador `%` de JS puede devolver un resto negativo — un
  // índice negativo en un array simplemente da `undefined`, no envuelve. Se
  // normaliza aquí para que `pick` sea correcto sea cual sea el signo de `seed`.
  const index = ((seed % arr.length) + arr.length) % arr.length;
  return arr[index];
}
