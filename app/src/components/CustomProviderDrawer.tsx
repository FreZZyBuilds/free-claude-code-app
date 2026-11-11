import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gauge, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportApply, useConfig } from "@/hooks/data";
import { api } from "@/lib/api";
import type { ApiFormat, CustomProvider } from "@/lib/types";
import { ApiKeyListEditor, keyRowsPayload, rowsFromValue, validateKeyRows, type KeyRow } from "./ApiKeyListEditor";
import { Button, Drawer, FieldShell, Input, Select, cx, inputClass } from "./ui";

const FORMATS: { value: ApiFormat; label: string; hint: string }[] = [
  { value: "openai_chat", label: "OpenAI Chat Completions", hint: "POST /chat/completions — most servers (vLLM, LiteLLM, TGI, …)" },
  { value: "openai_responses", label: "OpenAI Responses", hint: "POST /responses" },
  { value: "anthropic_messages", label: "Anthropic Messages", hint: "POST /messages — Anthropic-compatible gateways" },
];

const HISTORY = [
  { value: "disabled", label: "Don't replay reasoning" },
  { value: "reasoning_content", label: "reasoning_content field" },
  { value: "reasoning", label: "reasoning field" },
  { value: "think_tags", label: "<think> tags in content" },
];

const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function CustomProviderDrawer({ target, onClose }: { target: string | null; onClose: () => void }) {
  const { data: config } = useConfig();
  const existing = target && target !== "new" ? config?.custom_providers.find((c) => c.provider_id === target) : undefined;
  const open = target === "new" || !!existing;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={existing ? existing.display_name : "New custom provider"}
      subtitle="Any OpenAI- or Anthropic-compatible endpoint."
    >
      {open && config && <Body key={target ?? ""} existing={existing} onDone={onClose} />}
    </Drawer>
  );
}

function Body({ existing, onDone }: { existing?: CustomProvider; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: config } = useConfig();
  const [name, setName] = useState(existing?.display_name ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
  const [format, setFormat] = useState<ApiFormat>(existing?.api_format ?? "openai_chat");
  const [reasoning, setReasoning] = useState(existing?.reasoning_format ?? "provider_default");
  const [history, setHistory] = useState<string>(existing?.reasoning_history_format ?? "reasoning_content");
  const [models, setModels] = useState((existing?.model_ids ?? []).join("\n"));
  const [rows, setRows] = useState<KeyRow[]>(() => rowsFromValue(existing?.api_keys));
  const [rowErrors, setRowErrors] = useState<Record<number, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasoningOptions = config?.custom_reasoning_formats[format] ?? ["provider_default"];

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      const errs = validateKeyRows(rows);
      setRowErrors(errs);
      if (errs) throw new Error("Check the highlighted key rows.");
      const values: Record<string, unknown> = {
        display_name: name.trim(),
        base_url: baseUrl.trim(),
        api_format: format,
        reasoning_format: reasoningOptions.includes(reasoning) ? reasoning : "provider_default",
        reasoning_history_format: format === "openai_chat" ? history : "disabled",
        model_ids: models
          .split(/\r?\n|,/)
          .map((m) => m.trim())
          .filter(Boolean),
        api_keys: keyRowsPayload(existing?.api_keys.revision ?? null, rows),
      };
      return api.customProvider(
        existing ? { action: "update", provider_id: existing.provider_id, values } : { action: "create", values },
      );
    },
    onSuccess: async (r) => {
      if (!r.applied) {
        setError(r.errors.join("; ") || "The server rejected this provider.");
        return;
      }
      reportApply(r);
      await qc.invalidateQueries();
      onDone();
    },
    onError: (e) => setError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: () => api.customProvider({ action: "delete", provider_id: existing!.provider_id, values: {} }),
    onSuccess: async (r) => {
      if (!r.applied) {
        setError(r.errors.join("; "));
        return;
      }
      toast.success(`Removed ${existing!.display_name}`);
      await qc.invalidateQueries();
      onDone();
    },
    onError: (e) => setError((e as Error).message),
  });

  const test = useMutation({
    mutationFn: () => api.testProvider(existing!.provider_id),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Connected — ${r.models?.length ?? 0} models`)
        : toast.error("Provider check failed", { description: r.message }),
  });

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex-1 space-y-5">
        <FieldShell label="Name" htmlFor="cp-name">
          <Input id="cp-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="My vLLM box" />
        </FieldShell>
        <FieldShell label="Base URL" htmlFor="cp-url" description="The API root, e.g. http://localhost:8000/v1">
          <Input
            id="cp-url"
            required
            mono
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </FieldShell>
        <FieldShell label="API format" htmlFor="cp-format" description={FORMATS.find((f) => f.value === format)?.hint}>
          <Select id="cp-format" value={format} onChange={(e) => setFormat(e.target.value as ApiFormat)}>
            {FORMATS.filter((f) => !config?.custom_reasoning_formats || f.value in config.custom_reasoning_formats).map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </FieldShell>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell label="Reasoning format" htmlFor="cp-reasoning">
            <Select id="cp-reasoning" value={reasoningOptions.includes(reasoning) ? reasoning : "provider_default"} onChange={(e) => setReasoning(e.target.value)}>
              {reasoningOptions.map((o) => (
                <option key={o} value={o}>
                  {pretty(o)}
                </option>
              ))}
            </Select>
          </FieldShell>
          {format === "openai_chat" && (
            <FieldShell label="Reasoning history" htmlFor="cp-history">
              <Select id="cp-history" value={history} onChange={(e) => setHistory(e.target.value)}>
                {HISTORY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
          )}
        </div>
        <FieldShell
          label="Model IDs"
          htmlFor="cp-models"
          description="One per line. Leave empty to discover models from the endpoint's /models list."
        >
          <textarea
            id="cp-models"
            className={cx(inputClass, "h-28 py-2 font-mono text-[13px]")}
            value={models}
            onChange={(e) => setModels(e.target.value)}
            placeholder={"qwen3-coder-480b\nllama-4-maverick"}
          />
        </FieldShell>
        <FieldShell label="API keys" description="Optional for local servers. Keys rotate in this order.">
          <ApiKeyListEditor label="API key" rows={rows} onChange={setRows} errors={rowErrors} />
        </FieldShell>
        {error && <p className="rounded-xl border border-stop/30 bg-stop/8 px-4 py-3 text-sm text-stop">{error}</p>}
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">
        {existing && (
          <>
            <Button type="button" variant="danger" busy={remove.isPending} icon={<Trash2 className="size-4" />} onClick={() => remove.mutate()}>
              Remove
            </Button>
            <Button type="button" busy={test.isPending} icon={<Gauge className="size-4" />} onClick={() => test.mutate()}>
              Test
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={save.isPending}>
          {existing ? "Save" : "Add provider"}
        </Button>
      </div>
    </form>
  );
}
