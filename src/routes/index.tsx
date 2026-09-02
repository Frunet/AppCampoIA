import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, Clock, ListChecks, MessageSquare, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestión Agrícola de Fincas · Horas, compras y tareas" },
      {
        name: "description",
        content:
          "Controla horas de trabajadores, compras de insumos y tareas de campo en tus fincas de mango y aguacate, desde el móvil.",
      },
      { property: "og:title", content: "Gestión Agrícola de Fincas" },
      {
        property: "og:description",
        content: "Horas, compras de insumos, tareas e informes por finca con asistente de consultas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Clock, title: "Horas", text: "Jornadas por trabajador, con dictado por voz." },
  { icon: ShoppingCart, title: "Compras", text: "Insumos y materiales con factura adjunta." },
  { icon: ListChecks, title: "Tareas", text: "Planifica y sigue el trabajo de campo." },
  { icon: BarChart3, title: "Informes", text: "Totales y comparativas por finca." },
  { icon: MessageSquare, title: "Chat", text: "Consulta tus datos en lenguaje natural." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/horas", replace: true });
    });
  }, [navigate]);

  return (
    <div className="fondo-frunet min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Logo className="mb-6 h-10" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Gestión agrícola de tus fincas, desde el campo
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Horas de trabajadores, compras de insumos y tareas de campo en un solo sitio, para tus
          fincas de mango y aguacate. Cada encargado ve su finca; el administrador, el conjunto.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/auth">Acceder</Link>
        </Button>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface p-4">
              <f.icon className="mb-2 size-5 text-primary" />
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
