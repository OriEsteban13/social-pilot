import type { GenerateVideoInput, GeneratedVideoAsset, VideoProvider } from "../types";
import { MockImageProvider } from "./mock-image";

/**
 * No genera vídeo real (no hay proveedor de vídeo configurado en este
 * entorno — ver INTEGRATIONS.md). Produce guion + storyboard estructurado y
 * una miniatura de marca, de forma que la pieza queda lista en estado
 * "guion preparado" y no bloquea el resto del flujo editorial.
 */
export class MockVideoProvider implements VideoProvider {
  readonly id = "mock";
  private readonly imageProvider = new MockImageProvider();

  async generateVideo(input: GenerateVideoInput): Promise<GeneratedVideoAsset> {
    const sceneCount = Math.max(3, Math.min(6, Math.round(input.durationSeconds / 5)));
    const perScene = Math.round(input.durationSeconds / sceneCount);

    const storyboard = Array.from({ length: sceneCount }, (_, i) => {
      if (i === 0) return { scene: 1, description: `Hook inicial: capta la atención sobre "${input.brief}" en los primeros segundos.`, durationSeconds: perScene };
      if (i === sceneCount - 1) return { scene: i + 1, description: `Cierre con llamada a la acción de ${input.brandName}.`, durationSeconds: perScene };
      return { scene: i + 1, description: `Desarrollo del mensaje: punto clave ${i} sobre "${input.brief}".`, durationSeconds: perScene };
    });

    const script = storyboard
      .map((s) => `Escena ${s.scene} (${s.durationSeconds}s): ${s.description}`)
      .join("\n");

    const thumbnail = await this.imageProvider.generateImage({
      prompt: input.brief,
      aspectRatio: input.aspectRatio === "16:9" ? "16:9" : input.aspectRatio === "1:1" ? "1:1" : "9:16",
      headline: input.brief,
      brandName: input.brandName,
      brandColors: input.brandColors,
    });

    return {
      status: "SCRIPT_READY",
      script,
      storyboard,
      thumbnailUrl: thumbnail.url,
      provider: this.id,
    };
  }
}
