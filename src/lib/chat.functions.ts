import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(40),
});

export const askAgro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const [farmsRes, hoursRes, purchasesRes, tasksRes, catsRes] = await Promise.all([
      supabase.from("farms").select("id,name,fruits(name)"),
      supabase
        .from("work_hours")
        .select("farm_id,worker_name,work_date,hours,task_type,notes")
        .order("work_date", { ascending: false })
        .limit(800),
      supabase
        .from("purchases")
        .select("farm_id,purchase_date,item,category_id,quantity,unit,cost,supplier")
        .order("purchase_date", { ascending: false })
        .limit(800),
      supabase
        .from("tasks")
        .select("farm_id,title,status,due_date,assignee")
        .order("due_date", { ascending: false })
        .limit(500),
      supabase.from("supply_categories").select("id,name"),
    ]);

    const farms = farmsRes.data ?? [];
    const cats = catsRes.data ?? [];
    const farmName = (id: string) => farms.find((f) => f.id === id)?.name ?? "?";
    const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Sin categoría";

    const dataset = {
      hoy: new Date().toISOString().slice(0, 10),
      fincas: farms.map((f) => ({
        nombre: f.name,
        cultivo: (f.fruits as { name: string } | null)?.name ?? "",
      })),
      horas: (hoursRes.data ?? []).map((h) => ({
        finca: farmName(h.farm_id),
        trabajador: h.worker_name,
        fecha: h.work_date,
        horas: Number(h.hours),
        tarea: h.task_type,
        observaciones: h.notes ?? undefined,
      })),
      compras: (purchasesRes.data ?? []).map((p) => ({
        finca: farmName(p.farm_id),
        fecha: p.purchase_date,
        insumo: p.item,
        categoria: catName(p.category_id),
        cantidad: Number(p.quantity),
        unidad: p.unit,
        coste_eur: Number(p.cost),
        proveedor: p.supplier ?? undefined,
      })),
      tareas: (tasksRes.data ?? []).map((t) => ({
        finca: farmName(t.farm_id),
        tarea: t.title,
        estado: t.status,
        fecha: t.due_date ?? undefined,
        responsable: t.assignee ?? undefined,
      })),
    };

    const system = [
      "Eres el asistente de una empresa agrícola con fincas de mango y aguacate.",
      "Respondes SIEMPRE en español, de forma breve y clara, usando markdown cuando ayude (listas, tablas).",
      "Debes responder EXCLUSIVAMENTE con los datos JSON proporcionados abajo.",
      "Si un dato no está en el JSON, di claramente que no hay registros para esa consulta. Nunca inventes cifras.",
      "Cuando calcules totales, indica el periodo y la finca utilizados.",
      `DATOS (JSON): ${JSON.stringify(dataset)}`,
    ].join("\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { reply: "El asistente no está configurado (falta la clave de IA)." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) return { reply: "Demasiadas consultas seguidas. Prueba en un minuto." };
    if (res.status === 402)
      return { reply: "Se han agotado los créditos de IA del espacio de trabajo." };
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return { reply: "No se pudo consultar el asistente en este momento." };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "Sin respuesta." };
  });
