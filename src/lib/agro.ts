export type TaskStatus = "pendiente" | "en_curso" | "completada";
export type AppRole = "admin" | "manager";

export type Farm = {
  id: string;
  name: string;
  fruit_id: string;
  fruit_name: string;
  company_id: string | null;
  surface_m2: number | null;
  active: boolean;
};
export type Worker = {
  id: string;
  farm_id: string;
  name: string;
  active: boolean;
  idrh: string | null;
};
export type Category = { id: string; name: string };

// Catalogos de Inventarios (Fase 3) — sustituyen a las constantes estaticas
// TASK_TYPES/TASK_TYPE_HINT/VARIETIES/HARVEST_TASK que vivian aqui antes.
export type Company = { id: string; name: string; active: boolean };
export type Fruit = { id: string; name: string; active: boolean };
export type Variety = { id: string; fruit_id: string; name: string; active: boolean };
export type TaskType = {
  id: string;
  name: string;
  hint: string | null;
  is_harvest: boolean;
  sort_order: number | null;
  active: boolean;
};
export type LaborCostRate = {
  id: string;
  hourly_rate: number;
  valid_from: string;
  created_at: string;
};

// Años de cultivo por finca (Inventarios → ficha de finca) y la
// configuracion clave/valor de la app (Inventarios → "€ y horas").
export type CropYear = {
  id: string;
  farm_id: string;
  name: string;
  crop_start: string;
  crop_end: string;
  harvest_start: string;
  harvest_end: string;
};
export type AppSetting = { key: string; value: string };
export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
  farm_ids: string[];
};

/** Coste/hora vigente en una fecha: la ultima tarifa con valid_from <= fecha. */
export function rateForDate(rates: LaborCostRate[], date: string): number {
  const applicable = rates
    .filter((r) => r.valid_from <= date)
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1));
  return applicable[0]?.hourly_rate ?? 0;
}

export type WorkHour = {
  id: string;
  farm_id: string;
  worker_id: string | null;
  worker_name: string;
  work_date: string;
  hours: number;
  task_type: string;
  variety: string | null;
  kg: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  crop_year_id: string | null;
};

export type Purchase = {
  id: string;
  farm_id: string;
  purchase_date: string;
  item: string;
  category_id: string | null;
  quantity: number;
  unit: string;
  cost: number;
  supplier: string | null;
  attachment_path: string | null;
};

export type Task = {
  id: string;
  farm_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  assignee: string | null;
};

export const UNITS = ["ud", "kg", "L", "sacos", "cajas", "horas"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthRange = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

export const monthLabel = (key: string) => {
  const { from } = monthRange(key);
  return new Date(from + "T00:00:00Z").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

/** Claves "YYYY-MM" desde `from` hasta `to` (fechas ISO), en orden
 * cronologico, cruzando de un año calendario a otro si hace falta —
 * usado para las columnas del informe de jornales por año de cultivo. */
export const monthsBetween = (from: string, to: string): string[] => {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  const out: string[] = [];
  let y = fy!;
  let m = fm!;
  while (y < ty! || (y === ty! && m <= tm!)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
};

export const lastMonths = (n: number) => {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
};

export const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);

export const todayISO = () => new Date().toISOString().slice(0, 10);
