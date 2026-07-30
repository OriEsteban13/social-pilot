import { listMembers } from "@/server/services/workspace";
import { requireUser } from "@/server/auth/session";
import { TeamBoard } from "@/components/team/team-board";

export default async function TeamPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const [members, currentUser] = await Promise.all([listMembers(workspaceId), requireUser()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-sm text-muted-foreground">Gestiona quién puede ver, editar, revisar o administrar esta empresa.</p>
      </div>
      <TeamBoard workspaceId={workspaceId} members={members} currentUserId={currentUser.id} />
    </div>
  );
}
