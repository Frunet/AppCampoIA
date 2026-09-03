import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AppSetting,
  Category,
  Company,
  CropYear,
  Farm,
  Fruit,
  LaborCostRate,
  Purchase,
  Task,
  TaskType,
  UserRow,
  Variety,
  WorkHour,
  Worker,
} from "@/lib/agro";

export function useFarms() {
  return useQuery({
    queryKey: ["farms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("id,name,fruit_id,company_id,surface_m2,fruits(name)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        fruit_id: f.fruit_id,
        company_id: f.company_id,
        surface_m2: f.surface_m2,
        fruit_name: (f.fruits as { name: string } | null)?.name ?? "",
      })) as Farm[];
    },
  });
}

export function useWorkers(farmId?: string) {
  return useQuery({
    queryKey: ["workers", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("workers").select("id,farm_id,name,active,idrh").order("name");
      if (farmId) q = q.eq("farm_id", farmId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Worker[];
    },
  });
}

// ---------------------------------------------------------------------------
// Catalogos de Inventarios (Fase 3)
// ---------------------------------------------------------------------------

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });
}

export function useFruits() {
  return useQuery({
    queryKey: ["fruits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fruits").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Fruit[];
    },
  });
}

export function useVarieties() {
  return useQuery({
    queryKey: ["varieties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("varieties")
        .select("id,fruit_id,name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Variety[];
    },
  });
}

export function useTaskTypes() {
  return useQuery({
    queryKey: ["task_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_types")
        .select("id,name,hint,is_harvest,sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as TaskType[];
    },
  });
}

export function useLaborCostRates() {
  return useQuery({
    queryKey: ["labor_cost_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labor_cost_rates")
        .select("id,hourly_rate,valid_from,created_at")
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LaborCostRate[];
    },
  });
}

/**
 * Usuarios + rol + fincas asignadas, para la pestaña "Responsables".
 * profiles/user_roles/farm_managers no tienen FK directa entre si (todas
 * apuntan a auth.users), asi que PostgREST no puede hacer el embed
 * automatico: se piden por separado y se combinan aqui.
 */
export function useUsersAdmin() {
  return useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const [profilesRes, rolesRes, fmRes] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name").order("email"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("farm_managers").select("user_id,farm_id"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (fmRes.error) throw fmRes.error;

      const roleByUser = new Map(rolesRes.data.map((r) => [r.user_id, r.role]));
      const farmsByUser = new Map<string, string[]>();
      for (const fm of fmRes.data) {
        const list = farmsByUser.get(fm.user_id) ?? [];
        list.push(fm.farm_id);
        farmsByUser.set(fm.user_id, list);
      }

      return profilesRes.data.map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleByUser.get(p.id) ?? null,
        farm_ids: farmsByUser.get(p.id) ?? [],
      })) as UserRow[];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_categories")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

/**
 * `range` filtra por work_date en el servidor, en vez de traer un lote fijo
 * y filtrar en el cliente: sin esto, un informe sobre todas las fincas (sin
 * farmId) que supere el limite se corta por las fechas mas antiguas del
 * lote y todos los totales agregados salen mal, sin ningun aviso.
 */
export function useWorkHours(farmId?: string, range?: { from: string; to: string }) {
  return useQuery({
    queryKey: ["work_hours", farmId ?? "all", range ? `${range.from}_${range.to}` : "recent"],
    queryFn: async () => {
      let q = supabase
        .from("work_hours")
        .select(
          "id,farm_id,worker_id,worker_name,work_date,hours,task_type,variety,kg,notes,created_at,created_by,updated_at,updated_by,crop_year_id",
        )
        .order("work_date", { ascending: false });
      if (farmId) q = q.eq("farm_id", farmId);
      if (range) {
        q = q.gte("work_date", range.from).lte("work_date", range.to).limit(5000);
      } else {
        q = q.limit(500);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WorkHour[];
    },
  });
}

export function usePurchases(farmId?: string) {
  return useQuery({
    queryKey: ["purchases", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("purchases")
        .select(
          "id,farm_id,purchase_date,item,category_id,quantity,unit,cost,supplier,attachment_path",
        )
        .order("purchase_date", { ascending: false })
        .limit(500);
      if (farmId) q = q.eq("farm_id", farmId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });
}

export function useTasks(farmId?: string) {
  return useQuery({
    queryKey: ["tasks", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id,farm_id,title,description,status,due_date,assignee")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500);
      if (farmId) q = q.eq("farm_id", farmId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useCropYears(farmId?: string) {
  return useQuery({
    queryKey: ["crop_years", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("crop_years")
        .select("id,farm_id,name,crop_start,crop_end,harvest_start,harvest_end")
        .order("crop_start", { ascending: false });
      if (farmId) q = q.eq("farm_id", farmId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CropYear[];
    },
  });
}

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ["app_settings", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data as AppSetting | null;
    },
  });
}

/** Horas por jornal, como numero. 7 (el valor de seed) si la fila aun no
 * existe o el valor guardado no es un numero valido. */
export function useHoursPerJornal() {
  const { data, ...rest } = useAppSetting("hours_per_jornal");
  const parsed = data ? Number(data.value) : NaN;
  const hoursPerJornal = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  return { ...rest, data: hoursPerJornal };
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
}
