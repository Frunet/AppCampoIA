import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { askAgro } from "@/lib/chat.functions";
import { AudioMessageButton } from "@/components/AudioMessageButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Asistente de consultas · Gestión Agrícola" },
      {
        name: "description",
        content:
          "Pregunta en lenguaje natural por horas, gastos y tareas de tus fincas y obtén resúmenes al instante.",
      },
      { property: "og:title", content: "Asistente de consultas · Gestión Agrícola" },
      { property: "og:description", content: "Informes conversacionales sobre tus datos reales." },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cuántas horas se han trabajado este mes en Pai Mango?",
  "¿Cuánto hemos gastado en fitosanitarios en Avoclan Fortaleza este mes?",
  "Resumen de tareas completadas esta semana en Río Seco",
  "Compara el gasto en insumos entre las tres fincas de mango este mes",
];

function ChatPage() {
  const ask = useServerFn(askAgro);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo consultar el asistente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <h1 className="mb-4 text-lg font-semibold">Asistente de consultas</h1>

      <div className="mb-4 flex-1 space-y-3">
        {messages.length === 0 && (
          <div className="surface p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" /> Pregunta sobre tus datos reales
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                : "surface max-w-[95%] px-3.5 py-2.5 text-sm"
            }
          >
            {m.role === "assistant" ? (
              <div className="prose-sm space-y-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_table]:w-full [&_td]:py-1 [&_th]:text-left">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}

        {loading && (
          <div className="surface max-w-[60%] px-3.5 py-2.5 text-sm text-muted-foreground">
            Consultando los datos…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-16 flex gap-2 bg-background py-2 md:bottom-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe o dicta tu pregunta…"
        />
        <AudioMessageButton disabled={loading} onTranscript={(text) => send(text)} />
        <Button type="submit" size="icon" disabled={loading} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
