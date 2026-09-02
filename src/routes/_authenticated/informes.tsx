import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  useCategories,
  useFarms,
  useLaborCostRates,
  usePurchases,
  useTaskTypes,
  useTasks,
  useWorkHours,
} from "@/hooks/use-agro";
import { FarmPicker } from "@/components/FarmPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  eur,
  monthKey,
  monthLabel,
  monthRange,
  rateForDate,
  type Farm,
  type TaskType,
  type WorkHour,
} from "@/lib/agro";
import { exportWorkHoursToExcel, type WorkHourAudit } from "@/lib/export-horas";
import { resolveUserNames } from "@/lib/informes-export.functions";

export const Route = createFileRoute("/_authenticated/informes")({
  head: () => ({
    meta: [
      { title: "Informes por finca · Gestión Agrícola" },
      {
        name: "description",
        content:
          "Resúmenes mensuales de horas trabajadas, gasto en insumos y tareas completadas por finca.",
      },
      { property: "og:title", content: "Informes por finca · Gestión Agrícola" },
      { property: "og:description", content: "Dashboard y comparativas entre fincas." },
    ],
  }),
  component: InformesPage,
});

function InformesPage() {
  const [month, setMonth] = useState(monthKey());
  const range = monthRange(month);
  const { data: farms = [] } = useFarms();
  const { data: hours = [] } = useWorkHours(undefined, range);
  const { data: purchases = [] } = usePurchases();
  const { data: tasks = [] } = useTasks();
  const { data: categories = [] } = useCategories();
  const { data: laborRates = [] } = useLaborCostRates();
  const { data: taskTypes = [] } = useTaskTypes();

  const rows = useMemo(() => {
    return farms.map((f) => {
      const h = hours.filter(
        (r) => r.farm_id === f.id && r.work_date >= range.from && r.work_date <= range.to,
      );
      const p = purchases.filter(
        (r) => r.farm_id === f.id && r.purchase_date >= range.from && r.purchase_date <= range.to,
      );
      const t = tasks.filter((r) => r.farm_id === f.id);
      return {
        farm: f,
        horas: h.reduce((s, r) => s + Number(r.hours), 0),
        gasto: p.reduce((s, r) => s + Number(r.cost), 0),
        // Coste de personal: para cada registro se aplica la tarifa vigente
        // en SU fecha, no la del mes en curso — asi un cambio de tarifa a
        // mitad de mes reparte el coste correctamente entre los dias.
        costePersonal: h.reduce(
          (s, r) => s + Number(r.hours) * rateForDate(laborRates, r.work_date),
          0,
        ),
        completadas: t.filter((r) => r.status === "completada").length,
        pendientes: t.filter((r) => r.status !== "completada").length,
      };
    });
  }, [farms, hours, purchases, tasks, laborRates, range.from, range.to]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    purchases
      .filter((p) => p.purchase_date >= range.from && p.purchase_date <= range.to)
      .forEach((p) => {
        const name = categories.find((c) => c.id === p.category_id)?.name ?? "Sin categoría";
        map.set(name, (map.get(name) ?? 0) + Number(p.cost));
      });
    return [...map.entries()].map(([name, gasto]) => ({ name, gasto }));
  }, [purchases, categories, range.from, range.to]);

  const totals = rows.reduce(
    (acc, r) => ({
      horas: acc.horas + r.horas,
      gasto: acc.gasto + r.gasto,
      costePersonal: acc.costePersonal + r.costePersonal,
      completadas: acc.completadas + r.completadas,
      pendientes: acc.pendientes + r.pendientes,
    }),
    { horas: 0, gasto: 0, costePersonal: 0, completadas: 0, pendientes: 0 },
  );

  const horasChartData = rows.map((r) => ({ name: r.farm.name, Horas: Number(r.horas.toFixed(1)) }));
  const gastoChartData = rows.map((r) => ({
    name: r.farm.name,
    "Gasto (€)": Number(r.gasto.toFixed(2)),
    "Coste personal (€)": Number(r.costePersonal.toFixed(2)),
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="mr-auto text-lg font-semibold">Informes</h1>
        <Input
          type="month"
          className="w-40"
          value={month}
          onChange={(e) => setMonth(e.target.value || monthKey())}
        />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" /> Exportar PDF
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Resumen de {monthLabel(month)}</p>

      <Tabs defaultValue="horas">
        <TabsList className="mb-4">
          <TabsTrigger value="horas">Informes Horas</TabsTrigger>
          <TabsTrigger value="economicos">Informes Económicos</TabsTrigger>
        </TabsList>

        <TabsContent value="horas">
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Kpi label="Horas trabajadas" value={`${totals.horas.toFixed(1)} h`} />
            <Kpi label="Tareas completadas" value={String(totals.completadas)} />
            <Kpi label="Tareas pendientes" value={String(totals.pendientes)} />
          </div>

          <div className="surface mb-5 overflow-x-auto p-4">
            <h2 className="mb-3 text-sm font-semibold">Totales por finca</h2>
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Finca</th>
                  <th className="pb-2">Cultivo</th>
                  <th className="pb-2 pl-3 text-right">Horas</th>
                  <th className="pb-2 pl-3 text-right">Compl./Pend.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.farm.id} className="border-t border-border">
                    <td className="py-2 font-medium">{r.farm.name}</td>
                    <td className="py-2 capitalize text-muted-foreground">{r.farm.fruit_name}</td>
                    <td className="py-2 pl-3 text-right">{r.horas.toFixed(1)}</td>
                    <td className="py-2 pl-3 text-right">
                      {r.completadas}/{r.pendientes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="surface mb-5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Comparativa de horas entre fincas</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horasChartData} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Horas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ExportHorasCard farms={farms} taskTypes={taskTypes} defaultRange={range} />
        </TabsContent>

        <TabsContent value="economicos">
          <div className="mb-5 grid grid-cols-2 gap-3">
            <Kpi label="Gasto en insumos" value={eur(totals.gasto)} />
            <Kpi label="Coste de personal" value={eur(totals.costePersonal)} />
          </div>
          {laborRates.length === 0 && (
            <p className="mb-5 -mt-3 text-xs text-muted-foreground">
              El coste de personal sale en 0 € porque todavía no hay ninguna tarifa cargada en
              Inventarios → Coste hora.
            </p>
          )}

          <div className="surface mb-5 overflow-x-auto p-4">
            <h2 className="mb-3 text-sm font-semibold">Totales por finca</h2>
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Finca</th>
                  <th className="pb-2">Cultivo</th>
                  <th className="pb-2 pl-3 text-right">Gasto</th>
                  <th className="pb-2 pl-3 text-right">Coste personal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.farm.id} className="border-t border-border">
                    <td className="py-2 font-medium">{r.farm.name}</td>
                    <td className="py-2 capitalize text-muted-foreground">{r.farm.fruit_name}</td>
                    <td className="py-2 pl-3 text-right">{eur(r.gasto)}</td>
                    <td className="py-2 pl-3 text-right">{eur(r.costePersonal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="surface mb-5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Comparativa de gasto entre fincas</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gastoChartData} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Gasto (€)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Coste personal (€)" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Gasto por categoría de insumo</h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin compras este mes.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="gasto" name="Gasto (€)" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exportar horas a Excel (con auditoria) — solo en esta pestaña.
// ---------------------------------------------------------------------------

function ExportHorasCard({
  farms,
  taskTypes,
  defaultRange,
}: {
  farms: Farm[];
  taskTypes: TaskType[];
  defaultRange: { from: string; to: string };
}) {
  const [farmId, setFarmId] = useState<string | undefined>(undefined); // undefined = "Todas"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const resolveNames = useServerFn(resolveUserNames);

  const effFrom = from || defaultRange.from;
  const effTo = to || defaultRange.to;
  const { data: exportHours = [] } = useWorkHours(farmId, { from: effFrom, to: effTo });

  async function runExport() {
    if (effFrom > effTo) {
      toast.error("La fecha inicial es posterior a la final");
      return;
    }
    if (!exportHours.length) {
      toast.error("No hay registros en ese rango de fechas");
      return;
    }
    setExporting(true);
    try {
      const ids = [
        ...new Set(
          exportHours.flatMap((r) => [r.created_by, r.updated_by]).filter((x): x is string => !!x),
        ),
      ];
      const { names } = ids.length ? await resolveNames({ data: { userIds: ids } }) : { names: {} };

      const audit = new Map<string, WorkHourAudit>(
        exportHours.map((r) => [
          r.id,
          {
            created_at: r.created_at,
            created_by_name: r.created_by ? (names[r.created_by] ?? null) : null,
            // Si updated_by esta vacio, el registro nunca paso por el
            // formulario de edicion (ver save() en horas.tsx) — se deja en
            // blanco en vez de mostrar el updated_at del trigger, que
            // avanza en cualquier UPDATE aunque no sepamos quien lo hizo.
            updated_at: r.updated_by ? r.updated_at : null,
            updated_by_name: r.updated_by ? (names[r.updated_by] ?? null) : null,
          },
        ]),
      );

      const farmNameById = new Map(farms.map((f) => [f.id, f.name]));
      const farmName = farmId
        ? (farms.find((f) => f.id === farmId)?.name ?? "finca")
        : (r: WorkHour) => farmNameById.get(r.farm_id) ?? "finca";

      exportWorkHoursToExcel(exportHours, taskTypes, { farmName, from: effFrom, to: effTo, audit });
      toast.success(`Excel generado (${exportHours.length} registros)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Exportar horas a Excel</h2>
      <FarmPicker farms={farms} value={farmId} onChange={setFarmId} allowAll />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="inf-exp-from" className="text-xs">
            Desde
          </Label>
          <Input id="inf-exp-from" type="date" value={effFrom} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="inf-exp-to" className="text-xs">
            Hasta
          </Label>
          <Input id="inf-exp-to" type="date" value={effTo} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={runExport}
        disabled={exporting}
      >
        <FileSpreadsheet className="mr-1.5 size-4" />
        {exporting ? "Generando…" : "Exportar Excel"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Incluye quién creó y quién modificó por última vez cada registro.
      </p>
    </div>
  );
}
