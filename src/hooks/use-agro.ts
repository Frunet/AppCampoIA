import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Farm, Purchase, Task, WorkHour, Worker } from "@/lib/agro";

export function useFarms() {
  return useQuery({
    queryKey: ["farms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("farms").select("id,name,crop").order("name");
      if (error) throw error;
      return (data ?? []) as Farm[];
    },
  });
}

export function useWorkers(farmId?: string) {
  return useQuery({
    queryKey: ["workers", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("workers").select("id,farm_id,name,active").order("name");
      if (farmId) q = q.eq("farm_id", farmId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Worker[];
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

export function useWorkHours(farmId?: string) {
  return useQuery({
    queryKey: ["work_hours", farmId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("work_hours")
        .select("id,farm_id,worker_id,worker_name,work_date,hours,task_type,variety,kg,notes")
        .order("work_date", { ascending: false })
        .limit(500);
      if (farmId) q = q.eq("farm_id", farmId);
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
