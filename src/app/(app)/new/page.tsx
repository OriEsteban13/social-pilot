import { requireUser } from "@/server/auth/session";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function NewWorkspacePage() {
  await requireUser();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 px-4 py-12">
      <OnboardingWizard />
    </div>
  );
}
