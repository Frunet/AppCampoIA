import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Clock, BarChart3, MessageSquare, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-agro";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

// Compras y Tareas ocultas (pendientes de desarrollo/rediseño, ver
// routes/_authenticated/compras.tsx y tareas.tsx) — no se listan aqui pero
// las rutas y las tablas siguen existiendo.
const TABS = [
  { to: "/horas", label: "Horas", icon: Clock },
  { to: "/informes", label: "Informes", icon: BarChart3 },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  // Solo admin: la ruta tambien se protege a nivel de beforeLoad, esto solo
  // evita mostrarla en la navegacion al resto de usuarios.
  { to: "/inventarios", label: "Inventarios", icon: Archive, adminOnly: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: isAdmin = false } = useIsAdmin();
  const visibleTabs = TABS.filter((t) => !("adminOnly" in t) || isAdmin);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="fondo-frunet min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo className="h-7 shrink-0" />
          <div className="mr-auto border-l border-border pl-3">
            <p className="text-sm font-semibold leading-tight">Gestión Agrícola</p>
            <p className="text-xs text-muted-foreground leading-tight">Fincas de mango y aguacate</p>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {visibleTabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card md:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <t.icon className="size-5" />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
