import * as XLSX from "xlsx";
import { TASK_TYPES, type WorkHour } from "@/lib/agro";

/** Column headers, matching the client's Excel template exactly. */
const CATEGORY_HEADERS: Record<string, string> = {
  "Instalación": "Instalación\u00a0(gomas riego, plásticos...)",
  "Suelos": "Suelos\u00a0(arado, desbroce, hierbas...)",
  "Liado/Guía de planta": "Liado/ Guía de planta",
  "Otros cuidados planta": "Otros cuidados planta\u00a0(tala, destalle...)",
  "Riego, Abonado y Tratamiento": "Riego, Abonado y Tratamiento\u00a0(sulfatos...)",
  "Cosecha/Recolección": "Cosecha/ Recolección",
  "Otros": "Otros",
};

const HEADERS = [
  "FECHA",
  "Nombre",
  "Horas Diarias",
  "Finca/Invernadero",
  ...TASK_TYPES.map((t) => CATEGORY_HEADERS[t] ?? t),
  "Tareas",
  "TOTAL",
];

/**
 * Exports work hours in the client's "DATOS" template:
 * one row per record, hours placed in the matching category column,
 * TOTAL as a live =SUM(E:K) formula.
 */
export function exportWorkHoursToExcel(
  records: WorkHour[],
  opts: { farmName: string; from: string; to: string },
) {
  const sorted = records
    .slice()
    .sort(
      (a, b) =>
        a.work_date.localeCompare(b.work_date) || a.worker_name.localeCompare(b.worker_name, "es"),
    );

  const aoa: (string | number | null)[][] = [HEADERS];

  sorted.forEach((r) => {
    const hours = Number(r.hours || 0);
    const cats = TASK_TYPES.map((t) => (r.task_type === t ? hours : null));
    const tareas = [r.variety ? `Variedad: ${r.variety}` : "", r.kg ? `${Number(r.kg)} kg` : "", r.notes ?? ""]
      .filter(Boolean)
      .join(" · ");
    aoa.push([r.work_date, r.worker_name, hours, opts.farmName, ...cats, tareas, null]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // TOTAL column formula per row (E..K = category columns)
  sorted.forEach((_, i) => {
    const row = i + 2;
    ws[`M${row}`] = { t: "n", f: `SUM(E${row}:K${row})` };
  });

  ws["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 13 },
    { wch: 20 },
    ...TASK_TYPES.map(() => ({ wch: 20 })),
    { wch: 34 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DATOS");

  const safeFarm = opts.farmName.replace(/[^\p{L}\p{N}]+/gu, "-");
  XLSX.writeFile(wb, `horas-${safeFarm}-${opts.from}_${opts.to}.xlsx`);
  return { records: sorted.length };
}
