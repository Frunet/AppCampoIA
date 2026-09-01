import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  transcript: z.string().min(2).max(2000),
  workers: z.array(z.string()).max(200),
  tasks: z.array(z.string()).max(30),
  varieties: z.array(z.string()).max(50),
  today: z.string().max(10),
});

export type ParsedHours = {
  workers: string[];
  work_date: string | null;
  hours: number | null;
  task_type: string | null;
  variety: string | null;
  kg: number | null;
  notes: string | null;
};

export const parseHoursFromVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("El dictado no está configurado (falta la clave de IA).");

    const system = [
      "Extraes datos de un parte de horas agrícola dictado en español.",
      `Hoy es ${data.today} (formato YYYY-MM-DD).`,
      `Trabajadores disponibles (usa EXACTAMENTE estos nombres, corrige errores de dictado): ${JSON.stringify(data.workers)}`,
      `Tipos de tarea permitidos (elige uno exacto): ${JSON.stringify(data.tasks)}`,
      `Variedades permitidas (solo si es cosecha): ${JSON.stringify(data.varieties)}`,
      "Devuelve SOLO un JSON con las claves: workers (array de nombres exactos), work_date (YYYY-MM-DD), hours (número de horas por trabajador), task_type, variety, kg, notes.",
      "Si un dato no se dice, usa null (o [] en workers). Interpreta 'ayer', 'hoy' y fechas relativas respecto a hoy.",
      "No inventes trabajadores que no estén en la lista.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Demasiadas peticiones seguidas. Prueba en un minuto.");
    if (res.status === 402) throw new Error("Se han agotado los créditos de IA del espacio.");
    if (!res.ok) {
      console.error("AI parse error", res.status, await res.text().catch(() => ""));
      throw new Error("No se pudo interpretar el dictado.");
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "")) as Record<string, unknown>;
    } catch {
      throw new Error("No se pudo interpretar el dictado.");
    }

    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const known = (v: unknown, list: string[]) => {
      const s = str(v);
      if (!s) return null;
      const hit = list.find((item) => norm(item) === norm(s));
      return hit ?? null;
    };

    const result: ParsedHours = {
      workers: Array.isArray(parsed["workers"])
        ? (parsed["workers"] as unknown[])
            .map((w) => known(w, data.workers))
            .filter((w): w is string => !!w)
        : [],
      work_date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed["work_date"] ?? ""))
        ? String(parsed["work_date"])
        : null,
      hours: num(parsed["hours"]),
      task_type: known(parsed["task_type"], data.tasks),
      variety: known(parsed["variety"], data.varieties),
      kg: num(parsed["kg"]),
      notes: str(parsed["notes"]),
    };

    return { transcript: data.transcript, parsed: result };
  });
