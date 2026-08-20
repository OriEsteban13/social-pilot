import { NextResponse } from "next/server";

/**
 * TEMPORAL — borrar en cuanto se confirme un modelo de Groq válido para esta
 * cuenta. Dos modelos "estándar" seguidos (kimi-k2-instruct-0905,
 * llama-3.3-70b-versatile) han dado 404 model_not_found en producción; esta
 * ruta consulta directamente la lista real de modelos disponibles para esta
 * cuenta/clave, ya que no se puede comprobar desde fuera de Render (la API
 * de Groq bloquea peticiones desde el entorno de desarrollo usado para
 * verificar este proyecto). Protegida con el mismo CRON_SECRET que el
 * endpoint de cron, para no dejarla abierta a cualquiera.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 400 });
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.json();
  return NextResponse.json({ status: response.status, body });
}
