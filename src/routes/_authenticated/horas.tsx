import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarms, useTaskTypes, useVarieties, useWorkHours, useWorkers } from "@/hooks/use-agro";
import { VoiceInput } from "@/components/VoiceInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO, type Worker } from "@/lib/agro";
import { parseHoursFromVoice } from "@/lib/horas-voice.functions";
import { AudioMessageButton } from "@/components/AudioMessageButton";
import { N8nJornalButton, type N8nLine } from "@/components/N8nJornalButton";
import { useServerFn } from "@tanstack/react-start";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/horas")({
  head: () => ({
    meta: [
      { title: "Horas de trabajadores · Gestión Agrícola" },
      {
        name: "description",
        content: "Registra y edita las horas diarias de cada trabajador por finca y tipo de tarea.",
      },
      { property: "og:title", content: "Horas de trabajadores · Gestión Agrícola" },
      { property: "og:description", content: "Control diario de jornadas por finca." },
    ],
  }),
  component: HorasPage,
});

const empty = {
  worker_ids: [] as string[],
  work_date: todayISO(),
  hours: "",
  task_type: "",
  variety: "",
  kg: "",
  notes: "",
};

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/**
 * Una linea de borrador: mismos campos que una fila de work_hours, mas un
 * id temporal (solo cliente, para poder editarla/quitarla antes de
 * confirmar). No se persiste en ningun sitio hasta que se pulsa
 * "REGISTRAR HORAS" — si se recarga la pagina, se pierde.
 */
type DraftLine = {
  draftId: string;
  farm_id: string;
  worker_id: string;
  worker_name: string;
  work_date: string;
  hours: number;
  task_type: string;
  variety: string | null;
  kg: number | null;
  notes: string | null;
};

/**
 * Expande el formulario en una linea por trabajador seleccionado — misma
 * logica que usaba save() para el INSERT multiple: los kg cosechados son
 * un total que se reparte a partes iguales entre los trabajadores.
 * Reutilizada tanto por el submit del formulario como por el dictado por
 * voz, para no duplicar el reparto en dos sitios.
 */
function buildDraftLines(
  selectedWorkers: Worker[],
  params: {
    farmId: string;
    work_date: string;
    hours: string;
    task_type: string;
    variety: string;
    kg: string;
    notes: string;
    isHarvest: boolean;
  },
): DraftLine[] {
  const totalKg = params.isHarvest && params.kg !== "" ? Number(params.kg) : null;
  return selectedWorkers.map((worker) => ({
    draftId: crypto.randomUUID(),
    farm_id: params.farmId,
    worker_id: worker.id,
    worker_name: worker.name,
    work_date: params.work_date,
    hours: Number(params.hours),
    task_type: params.task_type,
    variety: params.isHarvest && params.variety ? params.variety : null,
    kg: totalKg == null ? null : Math.round((totalKg / selectedWorkers.length) * 100) / 100,
    notes: params.notes || null,
  }));
}

function HorasPage() {
  const qc = useQueryClient();
  const { data: farms = [] } = useFarms();
  const [farmId, setFarmId] = useState<string | undefined>();
  const [dayFilter, setDayFilter] = useState("");
  const [form, setForm] = useState(empty);
  // editingId: id REAL de un registro ya guardado en work_hours (se pulso
  // el lapiz de la tabla de abajo) -> save() hace update() directo.
  const [editingId, setEditingId] = useState<string | null>(null);
  // editingDraftLine: se esta editando una linea que todavia solo vive en
  // el borrador (nunca toco la base de datos). Se guarda la linea entera
  // (no solo el id) y su indice, para poder restaurarla tal cual si se
  // cancela la edicion, y reinsertarla en su sitio si se confirma.
  const [editingDraftLine, setEditingDraftLine] = useState<{ line: DraftLine; index: number } | null>(
    null,
  );
  const [newWorker, setNewWorker] = useState("");
  const [showWorker, setShowWorker] = useState(false);
  const [dictating, setDictating] = useState(false);

  // Borrador de altas nuevas: no se persiste (ni BD ni localStorage). Si se
  // recarga la pagina se pierde — comportamiento aceptado explicitamente.
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [committing, setCommitting] = useState(false);

  // El formulario se comporta "en modo edicion de una sola linea" tanto si
  // se edita un registro real de BD como una linea de borrador: seleccion
  // de un solo trabajador, singular en las etiquetas, boton Cancelar.
  const isEditingSingle = !!editingId || !!editingDraftLine;

  const parseHours = useServerFn(parseHoursFromVoice);
  const { data: taskTypes = [] } = useTaskTypes();
  const { data: allVarieties = [] } = useVarieties();

  useEffect(() => {
    if (!farmId && farms.length) setFarmId(farms[0]!.id);
  }, [farms, farmId]);

  useEffect(() => {
    if (!form.task_type && taskTypes.length) {
      setForm((f) => ({ ...f, task_type: taskTypes[0]!.name }));
    }
  }, [taskTypes, form.task_type]);

  const { data: workers = [] } = useWorkers(farmId);
  const { data: records = [] } = useWorkHours(farmId);

  const last7Days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
  }, []);
  const weekFrom = last7Days[0]!;
  const weekTo = last7Days[6]!;

  const visibleRecords = useMemo(
    () =>
      records.filter((r) =>
        dayFilter ? r.work_date === dayFilter : r.work_date >= weekFrom && r.work_date <= weekTo,
      ),
    [records, dayFilter, weekFrom, weekTo],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleRecords>();
    for (const r of visibleRecords) {
      const list = map.get(r.work_date) ?? [];
      list.push(r);
      map.set(r.work_date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visibleRecords]);

  const total = visibleRecords.reduce((s, r) => s + Number(r.hours), 0);
  const totalKg = visibleRecords.reduce((s, r) => s + Number(r.kg || 0), 0);
  const draftTotal = draft.reduce((s, l) => s + l.hours, 0);
  const draftTotalKg = draft.reduce((s, l) => s + (l.kg ?? 0), 0);
  const isHarvest = taskTypes.find((t) => t.name === form.task_type)?.is_harvest ?? false;
  const currentFruit = farms.find((f) => f.id === farmId)?.fruit_id;
  const varieties = allVarieties.filter((v) => v.fruit_id === currentFruit);

  async function addWorker() {
    if (!farmId || !newWorker.trim()) return;
    const { error } = await supabase.from("workers").insert({ farm_id: farmId, name: newWorker.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewWorker("");
    setShowWorker(false);
    qc.invalidateQueries({ queryKey: ["workers"] });
    toast.success("Trabajador añadido");
  }

  function toggleWorker(id: string) {
    setForm((f) => {
      if (isEditingSingle) return { ...f, worker_ids: [id] };
      return {
        ...f,
        worker_ids: f.worker_ids.includes(id)
          ? f.worker_ids.filter((w) => w !== id)
          : [...f.worker_ids, id],
      };
    });
  }

  async function handleDictation(text: string) {
    if (!farmId) return;
    setDictating(true);
    try {
      const { parsed } = await parseHours({
        data: {
          transcript: text,
          workers: workers.map((w) => w.name),
          tasks: taskTypes.map((t) => t.name),
          varieties: varieties.map((v) => v.name),
          today: todayISO(),
        },
      });
      const matched = workers.filter((w) => parsed.workers.includes(w.name));

      if (parsed.workers.length > 0 && matched.length === 0) {
        toast.warning(`No encontré al trabajador "${parsed.workers.join(", ")}" en esta finca`);
        return;
      }

      // work_date/task_type resueltos ya (con fallback al formulario) para
      // poder construir las lineas de borrador directamente, sin pasar por
      // el form. hours no tiene fallback razonable si el dictado no lo
      // detecto: si tras el fallback sigue sin haber un numero valido, no
      // se puede montar una linea (work_hours.hours es NOT NULL) — en ese
      // caso se cae al comportamiento anterior (rellenar el formulario
      // para que el usuario complete el dato a mano), en vez de perder
      // silenciosamente los trabajadores ya detectados.
      const work_date = parsed.work_date ?? form.work_date;
      const task_type = parsed.task_type ?? form.task_type;
      const hours = parsed.hours != null ? String(parsed.hours) : form.hours;

      if (matched.length > 0 && hours !== "" && Number(hours) > 0) {
        const isH = taskTypes.find((t) => t.name === task_type)?.is_harvest ?? false;
        const lines = buildDraftLines(matched, {
          farmId,
          work_date,
          hours,
          task_type,
          variety: parsed.variety ?? form.variety,
          kg: parsed.kg != null ? String(parsed.kg) : form.kg,
          notes: parsed.notes ?? form.notes,
          isHarvest: isH,
        });
        setDraft((d) => [...d, ...lines]);
        setForm({ ...empty, work_date });
        toast.success(
          lines.length > 1
            ? `${lines.length} líneas añadidas a la lista`
            : "Línea añadida a la lista",
        );
        return;
      }

      // Sin trabajadores detectados, o detectados pero sin horas: se
      // rellena el formulario igual que antes para que el usuario lo
      // complete y lo añada a mano.
      setEditingId(null);
      setForm((f) => ({
        worker_ids: matched.length ? matched.map((w) => w.id) : f.worker_ids,
        work_date,
        hours,
        task_type,
        variety: parsed.variety ?? f.variety,
        kg: parsed.kg != null ? String(parsed.kg) : f.kg,
        notes: parsed.notes ?? f.notes,
      }));
      if (matched.length > 0) {
        toast.warning("Detecté al trabajador pero no las horas — revisa y añade la línea a mano.");
      } else {
        toast.success("Dictado interpretado — revisa y añade a la lista");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo interpretar el dictado");
    } finally {
      setDictating(false);
    }
  }



  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const selected = workers.filter((w) => form.worker_ids.includes(w.id));
    if (!selected.length) {
      toast.error("Selecciona al menos un trabajador");
      return;
    }
    const isH = taskTypes.find((t) => t.name === form.task_type)?.is_harvest ?? false;

    // Caso 1: editando un registro YA guardado en la base de datos (se
    // pulso el lapiz en la tabla de abajo) — sigue guardando al momento,
    // exactamente igual que siempre. No pasa por el borrador.
    if (editingId) {
      const totalKgForm = isH && form.kg !== "" ? Number(form.kg) : null;
      const payload = {
        farm_id: farmId,
        worker_id: selected[0]!.id,
        worker_name: selected[0]!.name,
        work_date: form.work_date,
        hours: Number(form.hours),
        task_type: form.task_type,
        variety: isH && form.variety ? form.variety : null,
        kg: totalKgForm,
        notes: form.notes || null,
      };
      // updated_at lo pone el trigger set_updated_at(); updated_by no tiene
      // default en la base (a diferencia de created_by), asi que se manda
      // explicito con el usuario que esta editando ahora mismo.
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_hours")
        .update({ ...payload, updated_by: userRes.user?.id ?? null })
        .eq("id", editingId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Registro actualizado");
      setForm({ ...empty, work_date: form.work_date });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["work_hours"] });
      return;
    }

    // Casos 2 y 3: alta nueva, o edicion de una linea que solo vive en el
    // borrador todavia — en ninguno de los dos se toca Supabase aqui.
    const lines = buildDraftLines(selected, {
      farmId,
      work_date: form.work_date,
      hours: form.hours,
      task_type: form.task_type,
      variety: form.variety,
      kg: form.kg,
      notes: form.notes,
      isHarvest: isH,
    });

    if (editingDraftLine) {
      // Se habia quitado del array al empezar a editar (ver
      // startEditDraftLine) — ahora se reincorpora en su sitio original,
      // con el mismo draftId para que sea la "misma" linea.
      const updated = { ...lines[0]!, draftId: editingDraftLine.line.draftId };
      setDraft((d) => {
        const next = [...d];
        next.splice(Math.min(editingDraftLine.index, next.length), 0, updated);
        return next;
      });
      setEditingDraftLine(null);
      toast.success("Línea actualizada");
    } else {
      setDraft((d) => [...d, ...lines]);
      toast.success(
        lines.length > 1 ? `${lines.length} líneas añadidas a la lista` : "Línea añadida a la lista",
      );
    }
    setForm({ ...empty, work_date: form.work_date });
  }

  function removeDraftLine(draftId: string) {
    setDraft((d) => d.filter((l) => l.draftId !== draftId));
  }

  // Lineas ya resueltas por el asistente de voz de n8n (puede haber varios
  // trabajadores/tareas en un mismo audio) — se anaden al borrador igual
  // que si vinieran del formulario, con su propio draftId de cliente.
  function addN8nLines(lines: N8nLine[]) {
    setDraft((d) => [...d, ...lines.map((line) => ({ ...line, draftId: crypto.randomUUID() }))]);
  }

  // Si hay una linea de borrador a medio editar (se quito del array en
  // startEditDraftLine), la devuelve a su sitio tal cual estaba, sin los
  // cambios a medio escribir. Se llama antes de arrancar CUALQUIER otro
  // modo de edicion (editar otro registro, cancelar) para que ese cambio
  // de modo nunca pierda silenciosamente la linea que se estaba editando.
  function restorePendingDraftEdit() {
    if (!editingDraftLine) return;
    setDraft((d) => {
      const next = [...d];
      next.splice(Math.min(editingDraftLine.index, next.length), 0, editingDraftLine.line);
      return next;
    });
    setEditingDraftLine(null);
  }

  function startEditDraftLine(line: DraftLine, index: number) {
    restorePendingDraftEdit();
    setEditingDraftLine({ line, index });
    setDraft((d) => d.filter((l) => l.draftId !== line.draftId));
    setEditingId(null);
    setForm({
      worker_ids: [line.worker_id],
      work_date: line.work_date,
      hours: String(line.hours),
      task_type: line.task_type,
      variety: line.variety ?? "",
      kg: line.kg == null ? "" : String(line.kg),
      notes: line.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    restorePendingDraftEdit();
    setEditingId(null);
    setForm(empty);
  }

  async function commitDraft() {
    if (!draft.length) return;
    setCommitting(true);
    try {
      const rows = draft.map(({ draftId: _draftId, ...row }) => row);
      const { error } = await supabase.from("work_hours").insert(rows);
      if (error) throw error;
      toast.success(
        `${draft.length} registro${draft.length > 1 ? "s" : ""} de horas registrado${draft.length > 1 ? "s" : ""}`,
      );
      setDraft([]);
      qc.invalidateQueries({ queryKey: ["work_hours"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron registrar las horas");
    } finally {
      setCommitting(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("work_hours").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["work_hours"] });
    toast.success("Registro eliminado");
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Horas de trabajadores</h1>

      <div className="surface mb-3 flex items-center gap-3 p-3">
        <AudioMessageButton disabled={dictating} onTranscript={handleDictation} />
        <p className="text-xs text-muted-foreground">
          {dictating
            ? "Interpretando el dictado…"
            : 'Dicta el parte: "Juan y María, 8 horas de cosecha de Osteen hoy, 400 kg".'}
        </p>
      </div>

      <div className="surface mb-3 p-3">
        <N8nJornalButton onLines={addN8nLines} />
      </div>

      <form onSubmit={save} className="surface mb-5 space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="farm">Finca</Label>
          <select
            id="farm"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={farmId ?? ""}
            onChange={(e) => setFarmId(e.target.value)}
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.fruit_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>
              {isEditingSingle ? "Trabajador" : "Trabajadores"}
              {!isEditingSingle && form.worker_ids.length > 1 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {form.worker_ids.length} seleccionados
                </span>
              )}
            </Label>
            <div className="flex items-center gap-1">
              {!isEditingSingle && workers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      worker_ids:
                        f.worker_ids.length === workers.length ? [] : workers.map((w) => w.id),
                    }))
                  }
                >
                  {form.worker_ids.length === workers.length ? "Ninguno" : "Todos"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Añadir trabajador"
                onClick={() => setShowWorker(!showWorker)}
              >
                <UserPlus className="size-4" />
              </Button>
            </div>
          </div>
          {workers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Añade trabajadores a esta finca con el botón +.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {workers.map((w) => {
                const on = form.worker_ids.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleWorker(w.id)}
                    className={
                      on
                        ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    }
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
          )}
          {!isEditingSingle && form.worker_ids.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Se creará un registro por trabajador con las mismas horas y tarea.
            </p>
          )}
        </div>

        {showWorker && (
          <div className="flex gap-2">
            <Input
              placeholder="Nombre del nuevo trabajador"
              value={newWorker}
              onChange={(e) => setNewWorker(e.target.value)}
            />
            <Button type="button" onClick={addWorker}>
              Añadir
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={form.work_date}
              onChange={(e) => setForm({ ...form, work_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hours">Horas</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              min="0"
              required
              inputMode="decimal"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task">Tipo de tarea</Label>
          <select
            id="task"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={form.task_type}
            onChange={(e) => setForm({ ...form, task_type: e.target.value })}
          >
            {taskTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.hint ?? t.name}
              </option>
            ))}
          </select>
        </div>

        {isHarvest && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="variety">Variedad</Label>
              <select
                id="variety"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {varieties.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kg">
                Kg cosechados{!isEditingSingle && form.worker_ids.length > 1 ? " (total, se reparte)" : ""}
              </Label>
              <Input
                id="kg"
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={form.kg}
                onChange={(e) => setForm({ ...form, kg: e.target.value })}
              />
            </div>
          </div>
        )}


        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="notes">Observaciones</Label>
            <VoiceInput
              onResult={(text) =>
                setForm((f) => ({ ...f, notes: f.notes ? `${f.notes} ${text}` : text }))
              }
            />
          </div>
          <Textarea
            id="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Opcional — puedes dictarlo con el micrófono"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            <Plus className="mr-1.5 size-4" />
            {isEditingSingle ? "Guardar cambios" : "Añadir a la lista"}
          </Button>
          {isEditingSingle && (
            <Button type="button" variant="outline" onClick={cancelEditing}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {draft.length > 0 && (
        <div className="surface mb-5 overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-border bg-muted/40 px-3 py-2">
            <h2 className="text-sm font-semibold">Líneas pendientes de registrar</h2>
            <span className="text-xs text-muted-foreground">
              {draftTotal.toFixed(1)} h{draftTotalKg > 0 ? ` · ${draftTotalKg.toFixed(0)} kg` : ""}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8">Trabajador</TableHead>
                <TableHead className="h-8">Finca</TableHead>
                <TableHead className="h-8">Fecha</TableHead>
                <TableHead className="h-8">Tipo de tarea</TableHead>
                <TableHead className="h-8">Variedad</TableHead>
                <TableHead className="h-8 text-right">Kg</TableHead>
                <TableHead className="h-8 text-right">Horas</TableHead>
                <TableHead className="h-8">Notas</TableHead>
                <TableHead className="h-8 w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.map((line, index) => (
                <TableRow key={line.draftId}>
                  <TableCell className="py-1 font-medium">{line.worker_name}</TableCell>
                  <TableCell className="py-1 text-muted-foreground">
                    {farms.find((f) => f.id === line.farm_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-1 text-muted-foreground">{line.work_date}</TableCell>
                  <TableCell className="py-1 text-muted-foreground">{line.task_type}</TableCell>
                  <TableCell className="py-1 text-muted-foreground">{line.variety ?? "—"}</TableCell>
                  <TableCell className="py-1 text-right text-muted-foreground">
                    {line.kg ?? "—"}
                  </TableCell>
                  <TableCell className="py-1 text-right font-semibold">{line.hours}</TableCell>
                  <TableCell
                    className="max-w-32 truncate py-1 text-muted-foreground"
                    title={line.notes ?? ""}
                  >
                    {line.notes ?? "—"}
                  </TableCell>
                  <TableCell className="py-1 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => startEditDraftLine(line, index)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar"
                        onClick={() => removeDraftLine(line.draftId)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3">
            <Button type="button" size="lg" className="w-full" onClick={commitDraft} disabled={committing}>
              <Save className="mr-1.5 size-4" />
              {committing ? "Registrando…" : "REGISTRAR HORAS"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-end">
        <p className="text-sm text-muted-foreground">
          {total.toFixed(1)} h{totalKg > 0 ? ` · ${totalKg.toFixed(0)} kg` : ""}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label className="text-sm font-medium">Filtrar por día</Label>
        <Input
          type="date"
          className="w-40"
          aria-label="Filtrar registros por día"
          min={last7Days[0]}
          max={last7Days[6]}
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
        />
        {dayFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDayFilter("")}>
            Ver 7 días
          </Button>
        )}
        {dayFilter ? (
          <p className="text-xs text-muted-foreground">
            Mostrando solo {dayLabel(dayFilter)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Mostrando los últimos 7 días</p>
        )}
      </div>

      <div className="space-y-4">
        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {dayFilter ? "Sin registros ese día." : "Sin registros en los últimos 7 días."}
          </p>
        )}
        {grouped.map(([date, rows]) => (
          <div key={date} className="surface overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-border bg-muted/40 px-3 py-2">
              <h2 className="text-sm font-semibold capitalize">{dayLabel(date)}</h2>
              <span className="text-xs text-muted-foreground">
                {rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1)} h
              </span>
            </div>
            <Table className="[table-layout:fixed]">
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 w-[168px]">Trabajador</TableHead>
                  <TableHead className="h-8 w-48">Tipo de tarea</TableHead>
                  <TableHead className="h-8 w-12 text-right">Horas</TableHead>
                  <TableHead className="h-8 w-48">Notas</TableHead>
                  <TableHead className="h-8 w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="w-[168px] py-1 font-medium">{r.worker_name}</TableCell>
                    <TableCell
                      className="w-48 truncate py-1 text-muted-foreground"
                      title={r.task_type}
                    >
                      {r.task_type}
                    </TableCell>
                    <TableCell className="w-12 py-1 text-right font-semibold">
                      {Number(r.hours)}
                    </TableCell>
                    <TableCell
                      className="w-48 truncate py-1 text-muted-foreground"
                      title={r.notes ?? ""}
                    >
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => {
                            restorePendingDraftEdit();
                            setEditingId(r.id);
                            setForm({
                              worker_ids: r.worker_id ? [r.worker_id] : [],
                              work_date: r.work_date,
                              hours: String(r.hours),
                              task_type: r.task_type,
                              variety: r.variety ?? "",
                              kg: r.kg == null ? "" : String(r.kg),
                              notes: r.notes ?? "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar"
                          onClick={() => remove(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

    </div>
  );
}
