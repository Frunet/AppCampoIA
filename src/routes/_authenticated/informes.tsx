import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
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
import {
  useCategories,
  useFarms,
  useLaborCostRates,
  usePurchases,
  useTasks,
  useWorkHours,
} from "@/hooks/use-agro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eur, monthKey, monthLabel, monthRange, rateForDate } from "@/lib/agro";

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

  const chartData = rows.map((r) => ({
    name: r.farm.name,
    Horas: Number(r.horas.toFixed(1)),
    "Gasto (€)": Number(r.gasto.toFixed(2)),
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Horas trabajadas" value={`${totals.horas.toFixed(1)} h`} />
        <Kpi label="Gasto en insumos" value={eur(totals.gasto)} />
        <Kpi label="Coste de personal" value={eur(totals.costePersonal)} />
        <Kpi label="Tareas completadas" value={String(totals.completadas)} />
        <Kpi label="Tareas pendientes" value={String(totals.pendientes)} />
      </div>
      {laborRates.length === 0 && (
        <p className="mb-5 -mt-3 text-xs text-muted-foreground">
          El coste de personal sale en 0 € porque todavía no hay ninguna tarifa cargada en
          Inventarios → Coste hora.
        </p>
      )}

      <div className="surface mb-5 overflow-x-auto p-4">
        <h2 className="mb-3 text-sm font-semibold">Totales por finca</h2>
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="pb-2">Finca</th>
              <th className="pb-2">Cultivo</th>
              <th className="pb-2 pl-3 text-right">Horas</th>
              <th className="pb-2 pl-3 text-right">Gasto</th>
              <th className="pb-2 pl-3 text-right">Coste personal</th>
              <th className="pb-2 pl-3 text-right">Compl./Pend.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.farm.id} className="border-t border-border">
                <td className="py-2 font-medium">{r.farm.name}</td>
                <td className="py-2 capitalize text-muted-foreground">{r.farm.fruit_name}</td>
                <td className="py-2 pl-3 text-right">{r.horas.toFixed(1)}</td>
                <td className="py-2 pl-3 text-right">{eur(r.gasto)}</td>
                <td className="py-2 pl-3 text-right">{eur(r.costePersonal)}</td>
                <td className="py-2 pl-3 text-right">
                  {r.completadas}/{r.pendientes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="surface mb-5 p-4">
        <h2 className="mb-3 text-sm font-semibold">Comparativa entre fincas</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Horas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gasto (€)" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
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
