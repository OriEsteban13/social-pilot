import type { ImageProvider, VideoProvider } from "./types";
import { MockImageProvider } from "./providers/mock-image";
import { MockVideoProvider } from "./providers/mock-video";
import { OpenAIImageProvider } from "./providers/openai-image";
import { FalImageProvider } from "./providers/fal-image";
import { FalVideoProvider } from "./providers/fal-video";

let imageProvider: ImageProvider | null = null;
let videoProvider: VideoProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (!imageProvider) {
    const configured = process.env.IMAGE_PROVIDER ?? "mock";
    imageProvider = configured === "fal" ? new FalImageProvider() : configured === "openai" ? new OpenAIImageProvider() : new MockImageProvider();
  }
  return imageProvider;
}

export function getVideoProvider(): VideoProvider {
  if (!videoProvider) {
    const configured = process.env.VIDEO_PROVIDER ?? "mock";
    videoProvider = configured === "fal" ? new FalVideoProvider() : new MockVideoProvider();
  }
  return videoProvider;
}
