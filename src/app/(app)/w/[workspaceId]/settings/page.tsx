import { getWorkspace, workspaceLanguages } from "@/server/services/workspace";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { MetricoolSettingsForm } from "@/components/settings/metricool-settings-form";
import { notFound } from "next/navigation";
import type { AutomationLevel } from "@/lib/enums";

export default async function SettingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Datos generales y nivel de automatización de esta empresa.</p>
      </div>
      <WorkspaceSettingsForm
        workspaceId={workspaceId}
        initial={{
          name: workspace.name,
          website: workspace.website ?? "",
          industry: workspace.industry ?? "",
          country: workspace.country ?? "",
          languages: workspaceLanguages(workspace).join(", "),
          automationLevel: workspace.automationLevel as AutomationLevel,
        }}
      />
      <MetricoolSettingsForm
        workspaceId={workspaceId}
        initialBlogId={workspace.metricoolBlogId ?? ""}
        socialProviderIsMetricool={process.env.SOCIAL_PROVIDER === "metricool"}
      />
    </div>
  );
}
