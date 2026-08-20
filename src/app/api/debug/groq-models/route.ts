import { NextResponse } from "next/server";
import { GroqAIProvider } from "@/server/ai/providers/groq";

/**
 * TEMPORAL — borrar en cuanto se confirme un modelo de Groq válido para esta
 * cuenta. Dos modelos "estándar" seguidos (kimi-k2-instruct-0905,
 * llama-3.3-70b-versatile) han dado 404 model_not_found en producción; esta
 * ruta consulta directamente la lista real de modelos disponibles para esta
 * cuenta/clave, ya que no se puede comprobar desde fuera de Render (la API
 * de Groq bloquea peticiones desde el entorno de desarrollo usado para
 * verificar este proyecto). Protegida con el mismo CRON_SECRET que el
 * endpoint de cron, para no dejarla abierta a cualquiera.
 *
 * `?test=1` hace además una llamada real de generación (una idea de
 * ejemplo) con el modelo configurado actualmente, para confirmar que
 * funciona de extremo a extremo antes de darlo por bueno en la app.
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

  const { searchParams } = new URL(request.url);
  if (searchParams.get("test") === "1") {
    try {
      const provider = new GroqAIProvider();
      const ideas = await provider.generateIdeas({
        brand: {
          workspaceName: "Camaleonic Survey",
          language: "en",
          tone: "CERCANO",
          targetAudiences: [],
          differentiators: ["AI-powered analysis"],
          claims: [],
          allowedTerms: [],
          forbiddenTerms: [],
          pillars: [{ id: "p1", name: "Product" }],
          valueProposition: "From response to insight in seconds.",
        },
        count: 2,
      });
      return NextResponse.json({ ok: true, model: process.env.GROQ_MODEL || "openai/gpt-oss-120b", ideas });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await response.json();
  return NextResponse.json({ status: response.status, body });
}
