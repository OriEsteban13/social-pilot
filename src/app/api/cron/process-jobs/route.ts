import { NextResponse } from "next/server";
import { processDueJobs } from "@/server/services/publishing";

/**
 * Endpoint invocado por Vercel Cron para procesar la cola de publicación
 * (`JobQueue`). Configurar en `vercel.json` con una expresión cron (p.ej.
 * cada 5 minutos) y proteger con `CRON_SECRET` en producción.
 *
 * En este entorno de desarrollo (sin Vercel Cron activo) la cola también se
 * procesa de forma oportunista desde el layout de cada workspace — ver
 * src/app/(app)/w/[workspaceId]/layout.tsx.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const results = await processDueJobs(50);
  return NextResponse.json({ processed: results.length, results });
}
