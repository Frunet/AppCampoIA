export type Crop = "mango" | "aguacate";
export type TaskStatus = "pendiente" | "en_curso" | "completada";

export type Farm = { id: string; name: string; crop: Crop };
export type Worker = { id: string; farm_id: string; name: string; active: boolean };
export type Category = { id: string; name: string };

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

export const TASK_TYPES = [
  "Instalación",
  "Suelos",
  "Liado/Guía de planta",
  "Otros cuidados planta",
  "Riego, Abonado y Tratamiento",
  "Cosecha/Recolección",
  "Otros",
];

export const HARVEST_TASK = "Cosecha/Recolección";

/** Hint shown next to each category (select options, Excel headers). */
export const TASK_TYPE_HINT: Record<string, string> = {
  Instalación: "Instalación",
  Suelos: "Suelos (arado, desbroce, hierbas...)",
  "Liado/Guía de planta": "Liado/Guía de planta",
  "Otros cuidados planta": "Otros cuidados planta (tala, destalle...)",
  "Riego, Abonado y Tratamiento": "Riego, Abonado y Tratamiento (sulfatos...)",
  "Cosecha/Recolección": "Cosecha/Recolección",
  Otros: "Otros",
};

export const VARIETIES: Record<Crop, string[]> = {
  mango: ["Osteen", "Keitt", "Kent", "Tommy Atkins", "Palmer", "Otra"],
  aguacate: ["Hass", "Fuerte", "Bacon", "Lamb Hass", "Reed", "Otra"],
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
