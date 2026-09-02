import * as XLSX from "xlsx";
import type { TaskType, WorkHour } from "@/lib/agro";

export type WorkHourAudit = {
  created_at: string;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES");
}

/**
 * Exports work hours in the client's "DATOS" template: one row per record,
 * hours placed in the matching category column, TOTAL as a live formula.
 *
 * Las columnas de categoria (una por task_type) ya no son una lista fija:
 * vienen del catalogo task_types (Inventarios), ordenado por sort_order.
 * El hint de cada tipo se usa como cabecera, igual que antes con
 * TASK_TYPE_HINT.
 *
 * `farmName` acepta un nombre fijo (uso de horas.tsx, una sola finca) o un
 * resolutor por registro (uso de informes.tsx cuando se exportan "Todas"
 * las fincas a la vez, cada fila con su propio nombre).
 *
 * `audit`, si se pasa, añade 4 columnas al final (Creado el/por, Modificado
 * el/por) resolviendo por record.id. Es opcional y solo lo usa la
 * exportacion de Informes — la de Horas no lo pasa y el Excel sale igual
 * que siempre.
 */
export function exportWorkHoursToExcel(
  records: WorkHour[],
  taskTypes: TaskType[],
  opts: {
    farmName: string | ((r: WorkHour) => string);
    from: string;
    to: string;
    audit?: Map<string, WorkHourAudit>;
  },
) {
  const resolveFarmName = typeof opts.farmName === "function" ? opts.farmName : () => opts.farmName as string;

  const headers = [
    "FECHA",
    "Nombre",
    "Horas Diarias",
    "Finca/Invernadero",
    ...taskTypes.map((t) => t.hint ?? t.name),
    "Tareas",
    "TOTAL",
    ...(opts.audit ? ["Creado el", "Creado por", "Modificado el", "Modificado por"] : []),
  ];

  const sorted = records
    .slice()
    .sort(
      (a, b) =>
        a.work_date.localeCompare(b.work_date) || a.worker_name.localeCompare(b.worker_name, "es"),
    );

  const aoa: (string | number | null)[][] = [headers];

  sorted.forEach((r) => {
    const hours = Number(r.hours || 0);
    const cats = taskTypes.map((t) => (r.task_type === t.name ? hours : null));
    const tareas = [r.variety ? `Variedad: ${r.variety}` : "", r.kg ? `${Number(r.kg)} kg` : "", r.notes ?? ""]
      .filter(Boolean)
      .join(" · ");
    const row: (string | number | null)[] = [
      r.work_date,
      r.worker_name,
      hours,
      resolveFarmName(r),
      ...cats,
      tareas,
      null,
    ];
    if (opts.audit) {
      const a = opts.audit.get(r.id);
      row.push(
        a ? formatDateTime(a.created_at) : "",
        a?.created_by_name ?? "",
        a?.updated_at ? formatDateTime(a.updated_at) : "",
        a?.updated_by_name ?? "",
      );
    }
    aoa.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Columna TOTAL: suma las columnas de categoria (empiezan en la E, tantas
  // como task_types haya). Las columnas de auditoria van despues, no
  // afectan a este calculo.
  const lastCatCol = XLSX.utils.encode_col(4 + taskTypes.length - 1);
  const totalCol = XLSX.utils.encode_col(4 + taskTypes.length + 1);
  sorted.forEach((_, i) => {
    const row = i + 2;
    ws[`${totalCol}${row}`] = { t: "n", f: `SUM(E${row}:${lastCatCol}${row})` };
  });

  ws["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 13 },
    { wch: 20 },
    ...taskTypes.map(() => ({ wch: 20 })),
    { wch: 34 },
    { wch: 10 },
    ...(opts.audit ? [{ wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }] : []),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DATOS");

  const farmLabel = typeof opts.farmName === "string" ? opts.farmName : "todas-las-fincas";
  const safeFarm = farmLabel.replace(/[^\p{L}\p{N}]+/gu, "-");
  XLSX.writeFile(wb, `horas-${safeFarm}-${opts.from}_${opts.to}.xlsx`);
  return { records: sorted.length };
}
