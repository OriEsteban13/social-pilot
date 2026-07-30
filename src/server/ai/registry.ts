import type { AIProvider } from "./types";
import { MockAIProvider } from "./providers/mock";
import { AnthropicAIProvider } from "./providers/anthropic";
import { GroqAIProvider } from "./providers/groq";

/**
 * Punto único de resolución del proveedor de IA activo. Por defecto usa
 * `MockAIProvider` (sin llamadas externas). Para activar Claude, define
 * `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`; para Groq (más barato/rápido,
 * modelos open-weight de terceros), `AI_PROVIDER=groq` + `GROQ_API_KEY` — ver
 * .env.example. Ningún otro archivo del dominio necesita cambiar.
 */

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const configured = process.env.AI_PROVIDER ?? "mock";

  switch (configured) {
    case "anthropic":
      cached = new AnthropicAIProvider();
      break;
    case "groq":
      cached = new GroqAIProvider();
      break;
    case "mock":
    default:
      cached = new MockAIProvider();
      break;
  }

  return cached;
}
