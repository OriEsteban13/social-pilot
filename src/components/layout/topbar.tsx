import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell, type NotificationItem } from "./notifications-bell";
import { WorkspaceStatusBadge } from "@/components/workspace/status-badge";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Topbar({
  workspaceId,
  workspaceName,
  status,
  notifications,
  unreadCount,
  userLabel,
}: {
  workspaceId: string;
  workspaceName: string;
  status: { label: string; tone: string };
  notifications: NotificationItem[];
  unreadCount: number;
  userLabel: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b px-4">
      <div className="flex items-center gap-3">
        <MobileNav workspaceId={workspaceId} workspaceName={workspaceName} />
        <span className="text-sm font-medium md:hidden">{workspaceName}</span>
        <WorkspaceStatusBadge label={status.label} tone={status.tone} />
      </div>
      <div className="flex items-center gap-1">
        <NotificationsBell notifications={notifications} unreadCount={unreadCount} />
        <ThemeToggle />
        <span className="mx-1 hidden text-sm text-muted-foreground sm:inline">{userLabel}</span>
        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
