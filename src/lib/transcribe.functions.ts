import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  // WAV mono 16 kHz codificado en base64 (sin prefijo data:)
  audio: z.string().min(1000).max(20_000_000),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("La transcripción no está configurada (falta la clave de IA).");

    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 2048) throw new Error("La grabación está vacía. Inténtalo de nuevo.");

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: "audio/wav" }), "grabacion.wav");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (res.status === 429) throw new Error("Demasiadas grabaciones seguidas. Prueba en un minuto.");
    if (res.status === 402) throw new Error("Se han agotado los créditos de IA del espacio.");
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("STT error", res.status, detail);
      throw new Error("No se pudo transcribir el audio.");
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
