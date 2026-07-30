import Link from "next/link";
import { Plus, Sparkles, LogOut } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listWorkspacesForUser, getWorkspaceStatus } from "@/server/services/workspace";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

export default async function HomePage() {
  const user = await requireUser();
  const workspaces = await listWorkspacesForUser(user.id);
  const statuses = await Promise.all(workspaces.map((w) => getWorkspaceStatus(w.id)));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-none">Camaleonic Social Pilot</h1>
            <p className="text-xs text-muted-foreground">Hola, {user.name ?? user.email}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </form>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Empresas</h2>
          <p className="text-sm text-muted-foreground">
            Cada empresa es un espacio independiente: su propia marca, calendario y automatizaciones.
          </p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus className="h-4 w-4" />
            Nueva empresa
          </Link>
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace, i) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} status={statuses[i]} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
      <Sparkles className="mb-4 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-medium">Todavía no tienes ninguna empresa</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Crea tu primera empresa para conectar sus redes sociales y dejar que la IA prepare su estrategia de contenidos.
      </p>
      <Button asChild>
        <Link href="/new">
          <Plus className="h-4 w-4" />
          Crear mi primera empresa
        </Link>
      </Button>
    </div>
  );
}
