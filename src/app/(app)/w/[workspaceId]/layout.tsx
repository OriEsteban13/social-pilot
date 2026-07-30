import { notFound } from "next/navigation";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { getWorkspace, getWorkspaceStatus } from "@/server/services/workspace";
import { listRecentNotifications, countUnread } from "@/server/services/notifications";
import { processDueJobs } from "@/server/services/publishing";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId);

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) notFound();

  // No hay un worker en background persistente en este entorno de desarrollo:
  // se procesan los jobs de publicación vencidos de forma oportunista en cada
  // visita a la empresa. En producción esto lo hace Vercel Cron —
  // ver /api/cron/process-jobs y ROADMAP.md.
  await processDueJobs();

  const [status, notifications, unreadCount] = await Promise.all([
    getWorkspaceStatus(workspaceId),
    listRecentNotifications(workspaceId, 8),
    countUnread(workspaceId),
  ]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar workspaceId={workspaceId} workspaceName={workspace.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          status={status}
          notifications={notifications}
          unreadCount={unreadCount}
          userLabel={user.name ?? user.email}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
