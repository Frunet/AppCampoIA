import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  transcript: z.string().min(2).max(2000),
  categories: z.array(z.string()).max(200),
  units: z.array(z.string()).max(30),
  today: z.string().max(10),
});

export type ParsedPurchase = {
  purchase_date: string | null;
  item: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  supplier: string | null;
};

export const parsePurchaseFromVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("El dictado no está configurado (falta la clave de IA).");

    const system = [
      "Extraes datos de una compra de insumos agrícolas dictada en español.",
      `Hoy es ${data.today} (formato YYYY-MM-DD).`,
      `Categorías disponibles (usa EXACTAMENTE una de estas, corrige errores de dictado): ${JSON.stringify(data.categories)}`,
      `Unidades permitidas (elige una exacta): ${JSON.stringify(data.units)}`,
      "Devuelve SOLO un JSON con las claves: purchase_date (YYYY-MM-DD), item (nombre del producto), category, quantity (número), unit, cost (importe total en euros), supplier (proveedor).",
      "Si un dato no se dice, usa null. Interpreta 'ayer', 'hoy' y fechas relativas respecto a hoy.",
      "'cost' es el importe total pagado. Si solo se dice el precio por unidad, multiplícalo por la cantidad.",
      "No inventes categorías que no estén en la lista; si ninguna encaja, usa null.",
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
      return list.find((item) => norm(item) === norm(s)) ?? null;
    };

    const result: ParsedPurchase = {
      purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed["purchase_date"] ?? ""))
        ? String(parsed["purchase_date"])
        : null,
      item: str(parsed["item"]),
      category: known(parsed["category"], data.categories),
      quantity: num(parsed["quantity"]),
      unit: known(parsed["unit"], data.units),
      cost: num(parsed["cost"]),
      supplier: str(parsed["supplier"]),
    };

    return { transcript: data.transcript, parsed: result };
  });
