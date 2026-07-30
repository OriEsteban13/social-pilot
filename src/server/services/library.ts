import { prisma } from "@/server/db/client";
import { jsonArray } from "@/lib/json";
import type { MediaType } from "@/lib/enums";

export async function listMediaAssets(workspaceId: string, filters?: { type?: MediaType; folder?: string; search?: string }) {
  return prisma.mediaAsset.findMany({
    where: {
      workspaceId,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.folder ? { folder: filters.folder } : {}),
      ...(filters?.search ? { url: { contains: filters.search } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMediaAsset(workspaceId: string, input: {
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  tags?: string[];
  folder?: string;
  sourceGenerator?: string;
  width?: number;
  height?: number;
}) {
  return prisma.mediaAsset.create({
    data: {
      workspaceId,
      type: input.type,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl,
      tags: jsonArray(input.tags ?? []),
      folder: input.folder,
      sourceGenerator: input.sourceGenerator,
      width: input.width,
      height: input.height,
    },
  });
}

export async function deleteMediaAsset(mediaAssetId: string) {
  return prisma.mediaAsset.delete({ where: { id: mediaAssetId } });
}
