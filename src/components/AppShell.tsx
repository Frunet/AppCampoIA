import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, ShoppingCart, ListChecks, BarChart3, MessageSquare, LogOut, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/horas", label: "Horas", icon: Clock },
  { to: "/compras", label: "Compras", icon: ShoppingCart },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/informes", label: "Informes", icon: BarChart3 },
  { to: "/chat", label: "Chat", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="size-5" />
          </div>
          <div className="mr-auto">
            <p className="text-sm font-semibold leading-tight">Gestión Agrícola</p>
            <p className="text-xs text-muted-foreground leading-tight">Fincas de mango y aguacate</p>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((t) => (
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
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
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
