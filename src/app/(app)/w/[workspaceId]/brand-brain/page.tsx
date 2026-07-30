import { getBrandProfile, getPillars, listWebsiteSources, listBrandAssets } from "@/server/services/brand-brain";
import { toStringArray } from "@/lib/json";
import { BrandProfileForm } from "@/components/brand-brain/brand-profile-form";
import { PillarsManager } from "@/components/brand-brain/pillars-manager";
import { WebsiteSources } from "@/components/brand-brain/website-sources";
import { BrandAssets } from "@/components/brand-brain/brand-assets";
import type { Tone } from "@/lib/enums";

export default async function BrandBrainPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const [profile, pillars, sources, assets] = await Promise.all([
    getBrandProfile(workspaceId),
    getPillars(workspaceId),
    listWebsiteSources(workspaceId),
    listBrandAssets(workspaceId),
  ]);

  const brandColors = toStringArray(profile?.brandColors as never);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand Brain</h1>
        <p className="text-sm text-muted-foreground">El corazón de la aplicación: todo lo que la IA sabe sobre tu marca.</p>
      </div>

      <BrandProfileForm
        workspaceId={workspaceId}
        initial={{
          description: profile?.description ?? "",
          valueProposition: profile?.valueProposition ?? "",
          tone: (profile?.tone as Tone) ?? "CERCANO",
          targetAudiences: toStringArray(profile?.targetAudiences as never).join(", "),
          differentiators: toStringArray(profile?.differentiators as never).join(", "),
          claims: toStringArray(profile?.claims as never).join(", "),
          allowedTerms: toStringArray(profile?.allowedTerms as never).join(", "),
          forbiddenTerms: toStringArray(profile?.forbiddenTerms as never).join(", "),
          brandColors: brandColors.length ? brandColors : ["#6366f1", "#0ea5e9"],
          competitors: toStringArray(profile?.competitors as never).join(", "),
        }}
      />

      <PillarsManager workspaceId={workspaceId} pillars={pillars} />
      <WebsiteSources workspaceId={workspaceId} sources={sources} />
      <BrandAssets workspaceId={workspaceId} assets={assets} />
    </div>
  );
}
