import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarms, useTasks, useWorkers } from "@/hooks/use-agro";
import { FarmPicker } from "@/components/FarmPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABEL, todayISO, type TaskStatus } from "@/lib/agro";
import { cn } from "@/lib/utils";

// PENDIENTE DE DESARROLLO/REDISEÑO — oculta intencionadamente del menu
// (ver AppShell.tsx) y bloqueada por URL directa con este beforeLoad. El
// codigo y la tabla tasks se dejan intactos, no se borra nada.
export const Route = createFileRoute("/_authenticated/tareas")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Tareas de campo · Gestión Agrícola" },
      {
        name: "description",
        content: "Planifica y sigue las tareas de campo por finca: pendientes, en curso y completadas.",
      },
      { property: "og:title", content: "Tareas de campo · Gestión Agrícola" },
      { property: "og:description", content: "Planificación y seguimiento de tareas por finca." },
    ],
  }),
  component: TareasPage,
});

const STATUSES: TaskStatus[] = ["pendiente", "en_curso", "completada"];

function splitAssignees(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function TareasPage() {
  const qc = useQueryClient();
  const { data: farms = [] } = useFarms();
  const [farmId, setFarmId] = useState<string | undefined>();
  const [form, setForm] = useState<{
    title: string;
    description: string;
    due_date: string;
    assignees: string[];
    status: TaskStatus;
  }>({
    title: "",
    description: "",
    due_date: todayISO(),
    assignees: [],
    status: "pendiente",
  });

  useEffect(() => {
    if (!farmId && farms.length) setFarmId((farms.find((f) => f.active) ?? farms[0])!.id);
  }, [farms, farmId]);

  // Igual que con los trabajadores: una finca inactiva no se ofrece para
  // altas nuevas, salvo que sea la que ya esta seleccionada.
  const selectableFarms = farms.filter((f) => f.active || f.id === farmId);

  const { data: tasks = [] } = useTasks(farmId);
  const { data: workers = [] } = useWorkers(farmId);
  const activeWorkers = workers.filter((w) => w.active);

  function toggleFormAssignee(name: string) {
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(name)
        ? f.assignees.filter((n) => n !== name)
        : [...f.assignees, name],
    }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const { error } = await supabase.from("tasks").insert({
      farm_id: farmId,
      title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
      assignee: form.assignees.length ? form.assignees.join(", ") : null,
      status: form.status,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({
      title: "",
      description: "",
      due_date: todayISO(),
      assignees: [],
      status: "pendiente",
    });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Tarea creada");
  }

  async function setStatus(id: string, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function toggleTaskAssignee(id: string, current: string | null, name: string) {
    const list = splitAssignees(current);
    const next = list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
    const { error } = await supabase
      .from("tasks")
      .update({ assignee: next.length ? next.join(", ") : null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Tareas de campo</h1>
      <FarmPicker farms={selectableFarms} value={farmId} onChange={setFarmId} />

      <form onSubmit={create} className="surface mb-5 space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Tarea</Label>
          <Input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due">Fecha</Label>
          <Input
            id="due"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={form.status === s}
                onClick={() => setForm({ ...form, status: s })}
                className={cn(
                  "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
                  form.status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Trabajadores asignados</Label>
          {activeWorkers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay trabajadores en esta finca. Añádelos desde Horas.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeWorkers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={form.assignees.includes(w.name)}
                  onClick={() => toggleFormAssignee(w.name)}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
                    form.assignees.includes(w.name)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Descripción (opcional)</Label>
          <Textarea
            id="desc"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full">
          <Plus className="mr-1.5 size-4" /> Añadir tarea
        </Button>
      </form>

      <div className="space-y-5">
        {STATUSES.map((status) => {
          const list = tasks.filter((t) => t.status === status);
          return (
            <section key={status}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {STATUS_LABEL[status]} ({list.length})
              </h2>
              <div className="space-y-2">
                {list.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nada por aquí.</p>
                )}
                {list.map((t) => {
                  const assigned = splitAssignees(t.assignee);
                  return (
                    <div key={t.id} className="surface p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.due_date ?? "sin fecha"}
                            {assigned.length ? ` · ${assigned.join(", ")}` : " · sin asignar"}
                          </p>
                          {t.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar"
                          onClick={() => remove(t.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>

                      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Estado
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={t.status === s}
                            onClick={() => setStatus(t.id, s)}
                            className={cn(
                              "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
                              t.status === s
                                ? "border-primary bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent",
                            )}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>

                      {activeWorkers.length > 0 && (
                        <>
                          <p className="mt-3 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <Users className="size-3" /> Trabajadores
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {activeWorkers.map((w) => (
                              <button
                                key={w.id}
                                type="button"
                                aria-pressed={assigned.includes(w.name)}
                                onClick={() => toggleTaskAssignee(t.id, t.assignee, w.name)}
                                className={cn(
                                  "rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
                                  assigned.includes(w.name)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent",
                                )}
                              >
                                {w.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
