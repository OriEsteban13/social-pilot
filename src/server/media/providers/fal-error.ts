/**
 * El cliente `@fal-ai/client` lanza `ApiError` con el detalle real del fallo
 * (saldo agotado, input inválido...) en `error.body.detail` — sin esto, solo
 * se ve el texto genérico del status HTTP (p.ej. "Forbidden"), que no dice
 * nada sobre la causa real. Se usa tanto en `fal-image.ts` como en
 * `fal-video.ts`.
 */
export function describeFalError(error: unknown): string {
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  }
  return error instanceof Error ? error.message : "error desconocido";
}
