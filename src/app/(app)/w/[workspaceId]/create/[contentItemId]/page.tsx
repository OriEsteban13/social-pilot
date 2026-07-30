import { notFound } from "next/navigation";
import { getContentItem, scoreVariant } from "@/server/services/content";
import { ContentEditor } from "@/components/content/content-editor";

export default async function ContentItemPage({
  params,
}: {
  params: Promise<{ workspaceId: string; contentItemId: string }>;
}) {
  const { workspaceId, contentItemId } = await params;
  const item = await getContentItem(contentItemId);
  if (!item || item.workspaceId !== workspaceId) notFound();

  const scores = Object.fromEntries(
    await Promise.all(item.variants.map(async (v) => [v.id, await scoreVariant(v.id)] as const))
  );

  return <ContentEditor workspaceId={workspaceId} item={item} scores={scores} />;
}
