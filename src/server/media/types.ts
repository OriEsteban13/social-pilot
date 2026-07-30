export type ImageAspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "1.91:1";

export interface GenerateImageInput {
  prompt: string;
  aspectRatio: ImageAspectRatio;
  headline?: string;
  subheadline?: string;
  brandName: string;
  brandColors: string[];
}

export interface GeneratedImage {
  url: string; // data URI en el proveedor mock; URL de storage en un proveedor real
  width: number;
  height: number;
  provider: string;
}

export interface ImageProvider {
  readonly id: string;
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}

export interface GenerateVideoInput {
  brief: string;
  brandName: string;
  brandColors: string[];
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
}

export interface GeneratedVideoAsset {
  // SCRIPT_READY: solo guion/storyboard, sin archivo de vídeo (proveedor mock).
  // VIDEO_READY: vídeo real generado — `videoUrl` apunta al archivo (proveedor fal.ai).
  status: "SCRIPT_READY" | "VIDEO_READY";
  script: string;
  storyboard: { scene: number; description: string; durationSeconds: number }[];
  thumbnailUrl: string;
  videoUrl?: string;
  provider: string;
}

export interface VideoProvider {
  readonly id: string;
  generateVideo(input: GenerateVideoInput): Promise<GeneratedVideoAsset>;
}
