import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/transcribe.functions";

type Props = { onTranscript: (text: string) => void; disabled?: boolean };

const TARGET_RATE = 16000;

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

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function AudioMessageButton({ onTranscript, disabled }: Props) {
  const transcribe = useServerFn(transcribeAudio);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

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
      const res = await transcribe({ data: { audio: await blobToBase64(wav) } });
      if (!res.text) {
        toast.error("No se entendió el audio, prueba otra vez");
        return;
      }
      onTranscript(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo transcribir el audio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      size="icon"
      disabled={disabled || busy}
      onClick={recording ? stop : start}
      aria-label={recording ? "Detener grabación" : "Grabar audio"}
      title={recording ? "Detener y enviar" : "Preguntar por voz"}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  );
}
