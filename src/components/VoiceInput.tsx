import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { onResult: (text: string) => void; label?: string };

export function VoiceInput({ onResult, label = "Dictar" }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onResult(text);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("No se pudo captar el audio");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [onResult]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="sm"
      onClick={() => {
        const rec = recognitionRef.current;
        if (!rec) return;
        if (listening) {
          rec.stop();
          setListening(false);
        } else {
          rec.start();
          setListening(true);
        }
      }}
    >
      {listening ? <MicOff className="mr-1.5 size-4" /> : <Mic className="mr-1.5 size-4" />}
      {listening ? "Escuchando…" : label}
    </Button>
  );
}
