import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useApply, useConfig, useModels, useRefreshModels } from "@/hooks/data";
import { modelNameOf, providerOf, TIER_COLORS, TIERS } from "@/lib/catalog";
import type { AdminConfig, ConfigField, ConfigValue } from "@/lib/types";
import { ModelCombobox } from "@/components/ModelCombobox";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Button, IconButton, PageHeader, Panel, Select, Spinner } from "@/components/ui";

interface Fallback {
  model: string;
  reasoning: string;
  api_key_number: number;
}

const ROUTES = [{ id: "default", name: "Default", modelKey: "MODEL", effortKey: "REASONING_POLICY" }, ...TIERS] as const;

export function RoutingPage() {
  const { data: config, isLoading } = useConfig();
  if (isLoading || !config) return <Spinner />;
  return <RoutingEditor key={JSON.stringify(config.fields.filter((f) => f.section === "models").map((f) => f.value))} config={config} />;
}

function RoutingEditor({ config }: { config: AdminConfig }) {
  const field = (k: string) => config.fields.find((f) => f.key === k) as ConfigField;
  const original = (k: string) => (field(k)?.value as string | null) ?? null;
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});
  const value = (k: string) => (k in drafts ? drafts[k] : original(k));
  const setValue = (k: string, v: string | null) =>
    setDrafts((d) => {
      const next = { ...d };
      if (v === original(k)) delete next[k];
      else next[k] = v;
      return next;
    });

  const originalFallbacks = useMemo<Fallback[]>(() => {
    try {
      return JSON.parse(original("MODEL_FALLBACKS") ?? "[]");
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
  const [fallbacks, setFallbacks] = useState<Fallback[]>(originalFallbacks);
  const fallbacksDirty = JSON.stringify(fallbacks) !== JSON.stringify(originalFallbacks);
  const dirtyCount = Object.keys(drafts).length + (fallbacksDirty ? 1 : 0);

  const apply = useApply();
  const refresh = useRefreshModels();
  const { data: models } = useModels();

  const save = () => {
    const values: Record<string, ConfigValue> = { ...drafts };
    if (fallbacksDirty) values.MODEL_FALLBACKS = fallbacks.length ? JSON.stringify(fallbacks) : null;
    apply.mutate(values, { onSuccess: (r) => r.applied && setDrafts({}) });
  };

  const keyCount = (modelRef: string) => {
    const pid = providerOf(modelRef);
    const p = config.provider_status.find((x) => x.provider_id === pid);
    const kf = p?.settings_keys.map((k) => field(k)).find((f) => f?.type === "api_key_list");
    const custom = config.custom_providers.find((c) => c.provider_id === pid);
    const n = (kf?.value as { entries: unknown[] } | null)?.entries.length ?? custom?.api_keys.entries.length ?? 1;
    return Math.max(1, n);
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Routing"
        description="Claude Code asks for Fable, Opus, Sonnet or Haiku. Patch each tier to any model — tiers left empty follow the default."
        actions={
          <Button busy={refresh.isPending} icon={<RefreshCw className="size-4" />} onClick={() => refresh.mutate()}>
            Discover models
          </Button>
        }
      />

      <PatchBay
        routes={ROUTES.map((r) => ({
          id: r.id,
          name: r.name,
          model: value(r.modelKey),
          effort: value(r.effortKey),
          effortOptions: field(r.effortKey)?.options ?? [],
          modelKey: r.modelKey,
          effortKey: r.effortKey,
        }))}
        defaultModel={value("MODEL") ?? ""}
        config={config}
        onModel={(k, v) => setValue(k, v)}
        onEffort={(k, v) => setValue(k, v)}
      />

      <Panel className="mt-6 p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Fallback chain</h2>
          <span className="text-xs text-faint">{models?.models.length ?? 0} models in catalog</span>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-muted">{field("MODEL_FALLBACKS")?.description}</p>
        <FallbackEditor
          value={fallbacks}
          onChange={setFallbacks}
          effortOptions={field("MODEL_FALLBACKS")?.options ?? []}
          keyCount={keyCount}
        />
      </Panel>

      {dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:left-64">
          <div className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-5 shadow-xl">
            <span className="text-sm">
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDrafts({});
                setFallbacks(originalFallbacks);
              }}
            >
              Discard
            </Button>
            <Button size="sm" variant="primary" busy={apply.isPending} onClick={save} className="rounded-full">
              Apply routing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface RouteRow {
  id: string;
  name: string;
  model: string | null;
  effort: string | null;
  effortOptions: { value: string; label: string }[];
  modelKey: string;
  effortKey: string;
}

/** Tier jacks on the left, distinct target models on the right, cables drawn between. */
function PatchBay({
  routes,
  defaultModel,
  config,
  onModel,
  onEffort,
}: {
  routes: RouteRow[];
  defaultModel: string;
  config: AdminConfig;
  onModel: (key: string, v: string | null) => void;
  onEffort: (key: string, v: string) => void;
}) {
  const resolved = routes.map((r) => ({ ...r, target: r.model ?? defaultModel }));
  const targets = [...new Set(resolved.map((r) => r.target).filter(Boolean))];

  const box = useRef<HTMLDivElement>(null);
  const jackRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const plugRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [paths, setPaths] = useState<{ id: string; d: string; inherited: boolean }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const b = el.getBoundingClientRect();
      setSize({ w: b.width, h: b.height });
      const next = resolved.flatMap((r) => {
        const a = jackRefs.current[r.id]?.getBoundingClientRect();
        const z = plugRefs.current[r.target]?.getBoundingClientRect();
        if (!a || !z || a.width === 0 || z.width === 0) return [];
        const x1 = a.left + a.width / 2 - b.left;
        const y1 = a.top + a.height / 2 - b.top;
        const x2 = z.left + z.width / 2 - b.left;
        const y2 = z.top + z.height / 2 - b.top;
        const dx = Math.max(40, (x2 - x1) * 0.5);
        return [{ id: r.id, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, inherited: r.id !== "default" && !r.model }];
      });
      setPaths(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(resolved.map((r) => [r.id, r.target]))]);

  const providerFor = (ref: string) => {
    const pid = providerOf(ref);
    const p = config.provider_status.find((x) => x.provider_id === pid);
    const custom = config.custom_providers.find((c) => c.provider_id === pid);
    return p ?? (custom ? { display_name: custom.display_name, logo_filename: null, status: "configured", label: "Custom" } : null);
  };

  return (
    <Panel className="p-4 sm:p-6">
      <div ref={box} className="relative grid gap-y-3 md:grid-cols-[minmax(0,1.35fr)_minmax(60px,0.5fr)_minmax(0,1fr)]">
        <svg className="pointer-events-none absolute inset-0 hidden md:block" width={size.w} height={size.h} aria-hidden>
          {paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke={TIER_COLORS[p.id]}
              strokeWidth={p.inherited ? 1.75 : 2.75}
              strokeOpacity={p.inherited ? 0.5 : 0.95}
              strokeDasharray={p.inherited ? "5 5" : undefined}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <ol className="space-y-3 md:col-start-1">
          {routes.map((r) => (
            <li
              key={r.id}
              className="relative rounded-xl border border-line bg-raised p-3"
              style={{ borderLeft: `3px solid ${TIER_COLORS[r.id]}` }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">{r.name}</span>
                {r.id !== "default" && !r.model && <span className="text-xs text-faint">follows default</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px]">
                <ModelCombobox
                  ariaLabel={`${r.name} model`}
                  optional={r.id !== "default"}
                  value={r.model}
                  onChange={(v) => onModel(r.modelKey, r.id === "default" ? v ?? defaultModel : v)}
                />
                <Select
                  aria-label={`${r.name} reasoning effort`}
                  value={r.effort ?? ""}
                  onChange={(e) => onEffort(r.effortKey, e.target.value)}
                >
                  {r.effortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value === "inherit" ? "Inherit effort" : o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <span
                ref={(el) => {
                  jackRefs.current[r.id] = el;
                }}
                className="absolute top-1/2 -right-[7px] hidden size-3.5 -translate-y-1/2 rounded-full border-2 border-surface md:block"
                style={{ background: TIER_COLORS[r.id] }}
                aria-hidden
              />
            </li>
          ))}
        </ol>

        <div className="hidden md:block" />

        <div className="flex flex-col justify-center gap-3 md:col-start-3">
          <div className="text-xs text-faint md:hidden">Resolved targets</div>
          {targets.map((t) => {
            const p = providerFor(t);
            const tiers = resolved.filter((r) => r.target === t);
            return (
              <div key={t} className="relative flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                <span
                  ref={(el) => {
                    plugRefs.current[t] = el;
                  }}
                  className="absolute top-1/2 -left-[7px] hidden size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-fg md:block"
                  aria-hidden
                />
                {p && <ProviderLogo provider={p} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[13px] font-medium" title={t}>
                    {modelNameOf(t)}
                  </div>
                  <div className="truncate text-xs text-faint">{p?.display_name ?? providerOf(t) ?? "Unknown provider"}</div>
                </div>
                <div className="flex -space-x-1">
                  {tiers.map((r) => (
                    <span
                      key={r.id}
                      title={r.name}
                      className="size-2.5 rounded-full ring-2 ring-surface"
                      style={{ background: TIER_COLORS[r.id] }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function FallbackEditor({
  value,
  onChange,
  effortOptions,
  keyCount,
}: {
  value: Fallback[];
  onChange: (v: Fallback[]) => void;
  effortOptions: { value: string; label: string }[];
  keyCount: (model: string) => number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const move = (i: number, d: number) => {
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  const update = (i: number, patch: Partial<Fallback>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">
          No fallbacks. If the routed model fails, the request fails.
        </p>
      )}
      <ol className="space-y-2">
        {value.map((f, i) => (
          <li key={`${f.model}-${f.api_key_number}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised p-2 pl-3">
            <span className="w-5 font-mono text-xs text-faint">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={f.model}>
              {f.model}
            </span>
            <Select
              aria-label={`Fallback ${i + 1} effort`}
              className="h-8 w-32 text-[13px]"
              value={f.reasoning}
              onChange={(e) => update(i, { reasoning: e.target.value })}
            >
              {effortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {keyCount(f.model) > 1 && (
              <Select
                aria-label={`Fallback ${i + 1} API key`}
                className="h-8 w-24 text-[13px]"
                value={f.api_key_number}
                onChange={(e) => update(i, { api_key_number: Number(e.target.value) })}
              >
                {Array.from({ length: keyCount(f.model) }, (_, k) => (
                  <option key={k} value={k + 1}>
                    Key {k + 1}
                  </option>
                ))}
              </Select>
            )}
            <IconButton label="Move up" className="size-8" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton label="Move down" className="size-8" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton label={`Remove fallback ${i + 1}`} className="size-8 hover:text-stop" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </IconButton>
          </li>
        ))}
      </ol>
      <div className="flex gap-2 pt-1">
        <div className="flex-1">
          <ModelCombobox ariaLabel="New fallback model" placeholder="Add a fallback provider/model" value={draft} onChange={setDraft} />
        </div>
        <Button
          icon={<Plus className="size-4" />}
          disabled={!draft || value.some((f) => f.model === draft && f.api_key_number === 1)}
          onClick={() => {
            if (!draft) return;
            onChange([...value, { model: draft, reasoning: "inherit", api_key_number: 1 }]);
            setDraft(null);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
