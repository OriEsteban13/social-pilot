import {
  LayoutDashboard,
  CalendarDays,
  PenSquare,
  Lightbulb,
  FileStack,
  Newspaper,
  Zap,
  Flag,
  BarChart3,
  BrainCircuit,
  Library,
  Share2,
  Users,
  Settings,
} from "lucide-react";

export function navItems(workspaceId: string) {
  const base = `/w/${workspaceId}`;
  return [
    { href: base, label: "Inicio", icon: LayoutDashboard, exact: true },
    { href: `${base}/calendar`, label: "Calendario", icon: CalendarDays },
    { href: `${base}/create`, label: "Crear contenido", icon: PenSquare },
    { href: `${base}/ideas`, label: "Ideas", icon: Lightbulb },
    { href: `${base}/blog`, label: "Blog", icon: Newspaper },
    { href: `${base}/posts`, label: "Publicaciones", icon: FileStack },
    { href: `${base}/automations`, label: "Automatizaciones", icon: Zap },
    { href: `${base}/campaigns`, label: "Campañas", icon: Flag },
    { href: `${base}/analytics`, label: "Analítica", icon: BarChart3 },
    { href: `${base}/brand-brain`, label: "Brand Brain", icon: BrainCircuit },
    { href: `${base}/library`, label: "Biblioteca", icon: Library },
    { href: `${base}/accounts`, label: "Redes conectadas", icon: Share2 },
    { href: `${base}/team`, label: "Equipo", icon: Users },
    { href: `${base}/settings`, label: "Configuración", icon: Settings },
  ];
}
