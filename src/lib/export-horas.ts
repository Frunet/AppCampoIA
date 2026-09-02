import * as XLSX from "xlsx";
import type { TaskType, WorkHour } from "@/lib/agro";

/**
 * Exports work hours in the client's "DATOS" template: one row per record,
 * hours placed in the matching category column, TOTAL as a live formula.
 *
 * Las columnas de categoria (una por task_type) ya no son una lista fija:
 * vienen del catalogo task_types (Inventarios), ordenado por sort_order.
 * El hint de cada tipo se usa como cabecera, igual que antes con
 * TASK_TYPE_HINT.
 */
export function exportWorkHoursToExcel(
  records: WorkHour[],
  taskTypes: TaskType[],
  opts: { farmName: string; from: string; to: string },
) {
  const headers = [
    "FECHA",
    "Nombre",
    "Horas Diarias",
    "Finca/Invernadero",
    ...taskTypes.map((t) => t.hint ?? t.name),
    "Tareas",
    "TOTAL",
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
    aoa.push([r.work_date, r.worker_name, hours, opts.farmName, ...cats, tareas, null]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Columna TOTAL: suma las columnas de categoria (empiezan en la E, tantas
  // como task_types haya).
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
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DATOS");

  const safeFarm = opts.farmName.replace(/[^\p{L}\p{N}]+/gu, "-");
  XLSX.writeFile(wb, `horas-${safeFarm}-${opts.from}_${opts.to}.xlsx`);
  return { records: sorted.length };
}
