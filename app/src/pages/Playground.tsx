import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, Eraser, KeyRound, SendHorizontal, Settings2, Square } from "lucide-react";
import { useConfig, useModels, useStatus } from "@/hooks/data";
import { TIER_COLORS, TIERS } from "@/lib/catalog";
import { Markdown } from "@/lib/markdown";
import { readPref, writePref } from "@/lib/prefs";
import { StreamError, streamMessage, type ChatMessage, type StreamUsage } from "@/lib/stream";
import { ModelCombobox } from "@/components/ModelCombobox";
import { Button, FieldShell, IconButton, Input, Panel, Switch, cx, inputClass } from "@/components/ui";

interface Turn extends ChatMessage {
  id: number;
  thinking?: string;
  error?: string;
  meta?: { model?: string; routed?: string; ttft?: number; ms?: number; usage?: StreamUsage; stop?: string | null };
  streaming?: boolean;
}

let nextId = 1;

const TIER_TARGETS = TIERS.map((t) => ({ id: t.id, label: t.name, model: t.probe }));

export function PlaygroundPage() {
  const { data: status } = useStatus();
  const { data: config } = useConfig();
  const authRequired = config?.fields.find((f) => f.key === "PROXY_AUTH_ENABLED")?.value === "true";

  const [target, setTarget] = useState<string>(() => readPref("pg-target", "sonnet"));
  const [direct, setDirect] = useState<string | null>(() => readPref("pg-direct", null));
  const [system, setSystem] = useState<string>(() => readPref("pg-system", ""));
  const [thinking, setThinking] = useState<boolean>(() => readPref("pg-thinking", false));
  const [maxTokens, setMaxTokens] = useState<number>(() => readPref("pg-max", 4096));
  const [token, setToken] = useState<string>(() => readPref("pg-token", ""));
  const [showOptions, setShowOptions] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => writePref("pg-target", target), [target]);
  useEffect(() => writePref("pg-direct", direct), [direct]);
  useEffect(() => writePref("pg-system", system), [system]);
  useEffect(() => writePref("pg-thinking", thinking), [thinking]);
  useEffect(() => writePref("pg-max", maxTokens), [maxTokens]);
  useEffect(() => writePref("pg-token", token), [token]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  const streaming = turns.some((t) => t.streaming);
  const model = target === "direct" ? direct ?? "" : TIER_TARGETS.find((t) => t.id === target)?.model ?? "";
  const fieldValue = (k: string) => config?.fields.find((f) => f.key === k)?.value as string | null | undefined;
  const tier = TIERS.find((t) => t.id === target);
  const routed = target === "direct" ? direct ?? "" : (tier && fieldValue(tier.modelKey)) || status?.model || "";

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !model) return;
    setInput("");
    const history: ChatMessage[] = [
      ...turns.filter((t) => !t.error && t.content).map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    const user: Turn = { id: nextId++, role: "user", content: text };
    const reply: Turn = { id: nextId++, role: "assistant", content: "", streaming: true, meta: { routed } };
    setTurns((t) => [...t, user, reply]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((x) => (x.id === reply.id ? fn(x) : x)));

    const started = performance.now();
    let first: number | undefined;
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await streamMessage(
        { model, messages: history, system, maxTokens, thinking, token: token || undefined, signal: ctrl.signal },
        {
          onStart: (info) => patch((t) => ({ ...t, meta: { ...t.meta, model: info.model } })),
          onText: (d) => {
            first ??= performance.now() - started;
            patch((t) => ({ ...t, content: t.content + d, meta: { ...t.meta, ttft: first } }));
          },
          onThinking: (d) => {
            first ??= performance.now() - started;
            patch((t) => ({ ...t, thinking: (t.thinking ?? "") + d, meta: { ...t.meta, ttft: first } }));
          },
          onUsage: (u) => patch((t) => ({ ...t, meta: { ...t.meta, usage: { ...t.meta?.usage, ...u } } })),
          onStop: (stop) => patch((t) => ({ ...t, meta: { ...t.meta, stop } })),
        },
      );
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError") {
        const hint = err instanceof StreamError && err.status === 401 ? " Add the proxy token under Options." : "";
        patch((t) => ({ ...t, error: err.message + hint }));
      }
    } finally {
      patch((t) => ({ ...t, streaming: false, meta: { ...t.meta, ms: performance.now() - started } }));
      abort.current = null;
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-3rem)] flex-col sm:h-[calc(100dvh-4.5rem)] lg:h-[calc(100dvh-4.5rem)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Playground</h1>
          <p className="mt-1 text-[15px] text-muted">
            Send a message through FCC exactly like Claude Code would, and see where it lands.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Clear conversation" disabled={!turns.length || streaming} onClick={() => setTurns([])}>
            <Eraser className="size-4.5" />
          </IconButton>
          <Button
            variant={showOptions ? "secondary" : "ghost"}
            icon={<Settings2 className="size-4" />}
            onClick={() => setShowOptions((v) => !v)}
            aria-expanded={showOptions}
          >
            Options
            <ChevronDown className={cx("size-4 transition-transform", showOptions && "rotate-180")} />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Route">
        {TIER_TARGETS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={target === t.id}
            onClick={() => setTarget(t.id)}
            className={cx(
              "flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
              target === t.id ? "border-fg bg-fg text-canvas" : "border-line-strong text-muted hover:text-fg",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: TIER_COLORS[t.id] }} />
            {t.label}
          </button>
        ))}
        <button
          role="radio"
          aria-checked={target === "direct"}
          onClick={() => setTarget("direct")}
          className={cx(
            "flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
            target === "direct" ? "border-fg bg-fg text-canvas" : "border-line-strong text-muted hover:text-fg",
          )}
        >
          Direct model
        </button>
        {target === "direct" && (
          <div className="w-full sm:w-96">
            <ModelCombobox ariaLabel="Direct model" value={direct} onChange={setDirect} placeholder="provider/model" />
          </div>
        )}
      </div>

      {showOptions && (
        <Panel className="mb-3 grid gap-4 p-4 md:grid-cols-[1fr_200px]">
          <FieldShell label="System prompt" htmlFor="pg-system">
            <textarea
              id="pg-system"
              className={cx(inputClass, "h-20 py-2")}
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="You are a concise senior engineer."
            />
          </FieldShell>
          <div className="space-y-4">
            <FieldShell label="Max tokens" htmlFor="pg-max">
              <Input
                id="pg-max"
                type="number"
                min={16}
                max={128000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(16, Number(e.target.value) || 16))}
              />
            </FieldShell>
            <div className="flex items-center justify-between">
              <label htmlFor="pg-think" className="flex items-center gap-2 text-sm font-medium">
                <Brain className="size-4 text-muted" /> Extended thinking
              </label>
              <Switch id="pg-think" label="Extended thinking" checked={thinking} onChange={setThinking} />
            </div>
          </div>
          {(authRequired || token) && (
            <FieldShell
              label={
                <span className="flex items-center gap-1.5">
                  <KeyRound className="size-4 text-muted" /> Proxy token
                </span>
              }
              htmlFor="pg-token"
              description="FCC requires API authentication. The token stays in this browser."
            >
              <Input id="pg-token" type="password" mono value={token} onChange={(e) => setToken(e.target.value)} />
            </FieldShell>
          )}
        </Panel>
      )}

      <Panel className="flex min-h-0 flex-1 flex-col">
        <div ref={scroller} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-medium">
                {target === "direct" ? "Pick a model and say hello" : `Talk to the ${TIER_TARGETS.find((t) => t.id === target)?.label} route`}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Messages go to <span className="font-mono text-[13px]">{routed || "—"}</span>.
              </p>
            </div>
          )}
          {turns.map((t) => (
            <Message key={t.id} turn={t} />
          ))}
        </div>
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Message"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask something…"
            title="Enter sends, Shift+Enter adds a line"
            className={cx(inputClass, "max-h-48 min-h-10 resize-none py-2 [field-sizing:content]")}
          />
          {streaming ? (
            <Button type="button" variant="secondary" icon={<Square className="size-4" />} onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!input.trim() || !model} icon={<SendHorizontal className="size-4" />}>
              Send
            </Button>
          )}
        </form>
      </Panel>
    </div>
  );
}

function Message({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);
  const { data: models } = useModels();
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-cobalt-500 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white">
          {turn.content}
        </div>
      </div>
    );
  }
  const m = turn.meta ?? {};
  const out = m.usage?.output_tokens;
  const genMs = m.ms && m.ttft ? m.ms - m.ttft : undefined;
  return (
    <div className="max-w-[92%]">
      {turn.thinking && (
        <div className="mb-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"
            aria-expanded={open}
          >
            <Brain className="size-3.5" /> Thinking
            <ChevronDown className={cx("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="mt-1.5 border-l-2 border-line-strong pl-3 text-[13px] whitespace-pre-wrap text-muted">
              {turn.thinking}
            </div>
          )}
        </div>
      )}
      {turn.content && <Markdown text={turn.content} />}
      {turn.streaming && !turn.content && !turn.thinking && (
        <div className="flex gap-1 py-2" aria-label="Waiting for the first token">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}
      {turn.error && (
        <div className="mt-1 rounded-xl border border-stop/30 bg-stop/8 px-3.5 py-2.5 text-sm text-stop">{turn.error}</div>
      )}
      {!turn.streaming && !turn.error && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
          {m.routed ? <span title={m.routed}>→ {models?.model_labels[m.routed] ?? m.routed}</span> : m.model && <span>{m.model}</span>}
          {m.ttft != null && <span>first token {(m.ttft / 1000).toFixed(2)}s</span>}
          {out != null && <span>{out} tokens out</span>}
          {out && genMs && genMs > 50 ? <span>{((out / genMs) * 1000).toFixed(0)} tok/s</span> : null}
          {m.stop && m.stop !== "end_turn" && <span>stop: {m.stop}</span>}
        </div>
      )}
    </div>
  );
}
