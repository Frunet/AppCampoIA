import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarms, useTaskTypes, useVarieties, useWorkHours, useWorkers } from "@/hooks/use-agro";
import { FarmPicker } from "@/components/FarmPicker";
import { VoiceInput } from "@/components/VoiceInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/agro";
import { exportWorkHoursToExcel } from "@/lib/export-horas";
import { parseHoursFromVoice } from "@/lib/horas-voice.functions";
import { AudioMessageButton } from "@/components/AudioMessageButton";
import { N8nJornalButton } from "@/components/N8nJornalButton";
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

function HorasPage() {
  const qc = useQueryClient();
  const { data: farms = [] } = useFarms();
  const [farmId, setFarmId] = useState<string | undefined>();
  const [dayFilter, setDayFilter] = useState("");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newWorker, setNewWorker] = useState("");
  const [showWorker, setShowWorker] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

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
  const isHarvest = taskTypes.find((t) => t.name === form.task_type)?.is_harvest ?? false;
  const currentFruit = farms.find((f) => f.id === farmId)?.fruit_id;
  const varieties = allVarieties.filter((v) => v.fruit_id === currentFruit);

  function exportExcel() {
    const from = exportFrom || weekFrom;
    const to = exportTo || weekTo;
    if (from > to) {
      toast.error("La fecha inicial es posterior a la final");
      return;
    }
    const rows = records.filter((r) => r.work_date >= from && r.work_date <= to);
    if (!rows.length) {
      toast.error("No hay registros en ese rango de fechas");
      return;
    }
    const farmName = farms.find((f) => f.id === farmId)?.name ?? "finca";
    exportWorkHoursToExcel(rows, taskTypes, { farmName, from, to });
    toast.success(`Excel generado (${rows.length} registros)`);
  }


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
      if (editingId) return { ...f, worker_ids: [id] };
      return {
        ...f,
        worker_ids: f.worker_ids.includes(id)
          ? f.worker_ids.filter((w) => w !== id)
          : [...f.worker_ids, id],
      };
    });
  }

  async function handleDictation(text: string) {
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
      const ids = workers.filter((w) => parsed.workers.includes(w.name)).map((w) => w.id);
      setEditingId(null);
      setForm((f) => ({
        worker_ids: ids.length ? ids : f.worker_ids,
        work_date: parsed.work_date ?? f.work_date,
        hours: parsed.hours != null ? String(parsed.hours) : f.hours,
        task_type: parsed.task_type ?? f.task_type,
        variety: parsed.variety ?? f.variety,
        kg: parsed.kg != null ? String(parsed.kg) : f.kg,
        notes: parsed.notes ?? f.notes,
      }));
      if (parsed.workers.length > 0 && ids.length === 0) {
        toast.warning(`No encontré al trabajador "${parsed.workers.join(", ")}" en esta finca`);
      } else {
        toast.success("Dictado interpretado — revisa y registra");
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
    const totalKgForm = isH && form.kg !== "" ? Number(form.kg) : null;
    const rows = selected.map((worker) => ({
      farm_id: farmId,
      worker_id: worker.id,
      worker_name: worker.name,
      work_date: form.work_date,
      hours: Number(form.hours),
      task_type: form.task_type,
      variety: isH && form.variety ? form.variety : null,
      kg: totalKgForm == null ? null : Math.round((totalKgForm / selected.length) * 100) / 100,
      notes: form.notes || null,
    }));
    let error;
    if (editingId) {
      // updated_at lo pone el trigger set_updated_at(); updated_by no tiene
      // default en la base (a diferencia de created_by), asi que se manda
      // explicito con el usuario que esta editando ahora mismo.
      const { data: userRes } = await supabase.auth.getUser();
      ({ error } = await supabase
        .from("work_hours")
        .update({ ...rows[0]!, updated_by: userRes.user?.id ?? null })
        .eq("id", editingId));
    } else {
      ({ error } = await supabase.from("work_hours").insert(rows));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      editingId
        ? "Registro actualizado"
        : `Horas registradas para ${selected.length} trabajador${selected.length > 1 ? "es" : ""}`,
    );
    setForm({ ...empty, work_date: form.work_date });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["work_hours"] });
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
      <FarmPicker farms={farms} value={farmId} onChange={setFarmId} />

      <div className="surface mb-3 flex items-center gap-3 p-3">
        <AudioMessageButton disabled={dictating} onTranscript={handleDictation} />
        <p className="text-xs text-muted-foreground">
          {dictating
            ? "Interpretando el dictado…"
            : 'Dicta el parte: "Juan y María, 8 horas de cosecha de Osteen hoy, 400 kg".'}
        </p>
      </div>

      <div className="surface mb-3 flex items-center gap-3 p-3">
        <N8nJornalButton onRegistered={() => qc.invalidateQueries({ queryKey: ["work_hours"] })} />
        <p className="text-xs text-muted-foreground">
          Crea el parte directamente por voz (IA de n8n) — sin pasar por el formulario.
        </p>
      </div>

      <form onSubmit={save} className="surface mb-5 space-y-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>
              {editingId ? "Trabajador" : "Trabajadores"}
              {!editingId && form.worker_ids.length > 1 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {form.worker_ids.length} seleccionados
                </span>
              )}
            </Label>
            <div className="flex items-center gap-1">
              {!editingId && workers.length > 1 && (
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
          {!editingId && form.worker_ids.length > 1 && (
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
                Kg cosechados{!editingId && form.worker_ids.length > 1 ? " (total, se reparte)" : ""}
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
            {editingId ? "Guardar cambios" : "Registrar horas"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm(empty);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <div className="mb-3 flex items-center justify-end">
        <p className="text-sm text-muted-foreground">
          {total.toFixed(1)} h{totalKg > 0 ? ` · ${totalKg.toFixed(0)} kg` : ""}
        </p>
      </div>

      <div className="surface mb-4 space-y-2 p-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Exportar a Excel por rango de fechas
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="exp-from" className="text-xs">
              Desde
            </Label>
            <Input
              id="exp-from"
              type="date"
              value={exportFrom || last7Days[0]}
              onChange={(e) => setExportFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-to" className="text-xs">
              Hasta
            </Label>
            <Input
              id="exp-to"
              type="date"
              value={exportTo || last7Days[6]}
              onChange={(e) => setExportTo(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={exportExcel}>
          <FileSpreadsheet className="mr-1.5 size-4" /> Exportar Excel
        </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Tipo de tarea</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-20 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.worker_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.task_type}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(r.hours)}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground" title={r.notes ?? ""}>
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => {
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
