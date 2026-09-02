import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceder · Gestión Agrícola de Fincas" },
      {
        name: "description",
        content:
          "Accede con tu usuario para registrar horas, compras y tareas de tus fincas de mango y aguacate.",
      },
      { property: "og:title", content: "Acceder · Gestión Agrícola de Fincas" },
      {
        property: "og:description",
        content: "Control de horas, compras de insumos y tareas de campo por finca.",
      },
    ],
  }),
  component: AuthPage,
});

/**
 * Supabase Auth identifica siempre por email, pero en campo se entra con
 * nombre de usuario ("pai", "frunet"...). Se completa con el dominio interno.
 * Si el usuario escribe algo con "@" se respeta tal cual, para las cuentas
 * que estan en otro dominio (p. ej. el admin de pruebas).
 */
const DOMINIO_INTERNO = "fincas.app";

function aEmail(usuario: string) {
  const limpio = usuario.trim().toLowerCase();
  return limpio.includes("@") ? limpio : `${limpio}@${DOMINIO_INTERNO}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/horas", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: aEmail(username),
          password,
        });
        if (error) throw error;
        navigate({ to: "/horas", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email: aEmail(username),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/horas`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ya puedes entrar.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la operación");
    } finally {
      setLoading(false);
    }
  }

  // Campos con borde verde redondeado, como en frunet.app/appcampo
  const inputClass = "rounded-xl border-2 border-primary/70 focus-visible:border-primary";

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      {/* Fondo corporativo Frunet */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/fondo-bio.webp')" }}
      />

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-10" />
          <p className="mt-3 text-sm font-medium text-foreground/70">
            Horas, compras y tareas de tus fincas
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 shadow-xl backdrop-blur-sm"
        >
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              type="text"
              inputMode="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="pai"
              className={inputClass}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              className={inputClass}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Procesando…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-wider text-foreground/60">
          Solo para personal autorizado
        </p>
      </div>
    </div>
  );
}
