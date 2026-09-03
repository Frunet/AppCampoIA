import { useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Una linea ya resuelta por n8n, lista para anadir al borrador — mismos
 * campos que una fila de work_hours (sin worker_id nulo: si no encontro un
 * trabajador real, esa linea se queda pidiendo aclaracion en vez de
 * devolverse aqui). */
export type N8nLine = {
  farm_id: string;
  worker_id: string;
  worker_name: string;
  work_date: string;
  hours: number;
  task_type: string;
  variety: string | null;
  kg: number | null;
  notes: string | null;
};

type Props = { disabled?: boolean; onLines: (lines: N8nLine[]) => void };

const TARGET_RATE = 16000;
const N8N_WEBHOOK_URL = "https://frunet.app.n8n.cloud/webhook/voice-jornal-app";

function downsample(chunks: Float32Array[], from: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    merged.set(c, o);
    o += c.length;
  }
  if (from <= TARGET_RATE) return merged;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(merged.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = merged[Math.floor(i * ratio)] ?? 0;
  return out;
}

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

type PendingLine = Record<string, unknown>;

type N8nResponse = {
  success: boolean;
  needsClarification: boolean;
  message: string;
  lines: N8nLine[];
  pending: PendingLine[] | null;
};

/**
 * Graba audio y lo envía al webhook de n8n ("Campo IA - Crear jornal por
 * voz"), que transcribe, extrae los datos (puede haber varios trabajadores
 * y/o tareas en un mismo audio) y devuelve un array de líneas ya resueltas
 * y filtradas por las fincas a las que tiene acceso el usuario. Este
 * componente las añade directamente al borrador de la pantalla — igual que
 * si vinieran del formulario — y es el usuario quien las confirma pulsando
 * "REGISTRAR HORAS".
 *
 * Si a alguna línea le falta un dato, la conversación sigue: se muestra la
 * pregunta del asistente y el próximo audio grabado se envía junto con el
 * contexto ya extraído (campo `pending` devuelto por n8n), hasta que esa
 * línea también queda completa.
 */
export function N8nJornalButton({ disabled, onLines }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const pendingContextRef = useRef<PendingLine[] | null>(null);
  const stateRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  function resetConversation() {
    pendingContextRef.current = null;
    setAssistantMessage(null);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      stateRef.current = { stream, ctx, node, source, chunks };
      setRecording(true);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }

  async function stop() {
    const s = stateRef.current;
    stateRef.current = null;
    setRecording(false);
    if (!s) return;
    s.stream.getTracks().forEach((t) => t.stop());
    s.node.disconnect();
    s.source.disconnect();
    const samples = downsample(s.chunks, s.ctx.sampleRate);
    await s.ctx.close();
    const wav = encodeWav(samples);
    if (wav.size < 4096) {
      toast.error("La grabación fue demasiado corta");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const form = new FormData();
      form.append("audio", wav, "jornal.wav");
      form.append("user_id", user?.id ?? "");
      if (pendingContextRef.current) {
        form.append("context", JSON.stringify(pendingContextRef.current));
      }
      const res = await fetch(N8N_WEBHOOK_URL, { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as N8nResponse | null;
      if (!res.ok || !json) {
        toast.error("No se pudo contactar con el asistente de voz");
        return;
      }
      if (json.lines?.length) {
        onLines(json.lines);
      }
      if (json.needsClarification) {
        pendingContextRef.current = json.pending ?? null;
        setAssistantMessage(json.message);
        toast.info(json.message);
      } else {
        resetConversation();
        if (json.lines?.length) {
          toast.success(json.message || "Líneas añadidas a la lista");
        } else {
          toast.error(json.message || "No he podido interpretar el audio, repite el dictado");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el audio");
    } finally {
      setBusy(false);
    }
  }

  const inConversation = assistantMessage !== null;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {inConversation && (
        <div className="flex items-start gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs">
          <p className="flex-1 text-muted-foreground">{assistantMessage}</p>
          <button
            type="button"
            onClick={resetConversation}
            disabled={recording || busy}
            aria-label="Cancelar conversación"
            title="Cancelar conversación"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <Button
        type="button"
        variant={recording ? "destructive" : "secondary"}
        size="lg"
        disabled={disabled || busy}
        onClick={recording ? stop : start}
        aria-label={recording ? "Detener y enviar" : inConversation ? "Responder por voz" : "Crear parte por voz (IA)"}
        title={recording ? "Detener y enviar" : inConversation ? "Responder por voz" : "Crear parte por voz (IA)"}
        className={cn("w-full", !recording && "bg-[#FAB514] font-bold text-black hover:bg-[#e0a410]")}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : recording ? (
          <Square className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}
        {busy ? "Procesando…" : recording ? "Detener y enviar" : inConversation ? "Responder por voz" : "Crear parte por voz (IA)"}
      </Button>
    </div>
  );
}
