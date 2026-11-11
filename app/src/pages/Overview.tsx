import { Link } from "react-router";
import { AlertTriangle, ArrowUpRight, Laptop, RefreshCw, TerminalSquare } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { displayHost, isReady, keys, providerTone, useConfig, useIsMobileServer, useModels, useProviderLookup, useRefreshModels, useStatus } from "@/hooks/data";
import { api, INTEGRATIONS } from "@/lib/api";
import { HARNESSES, INTEGRATION_META, modelNameOf, providerOf, TIER_COLORS, TIERS } from "@/lib/catalog";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Button, CopyButton, Panel, Pill, Spinner, StatusDot } from "@/components/ui";

function SignalPath() {
  const { data: status } = useStatus();
  const lookup = useProviderLookup();
  if (!status) return null;
  const provider = lookup(status.provider);
  const ready = provider ? isReady(provider) : false;
  const startupState = status.startup.providers[status.provider];
  const failing = startupState === "failed";
  return (
    <Panel className="relative overflow-hidden p-5 sm:p-7">
      <div className="text-sm text-muted">Requests from your coding agent currently flow to</div>
      <div className="mt-5 grid items-center gap-4 md:grid-cols-[auto_1fr_auto_1fr_minmax(0,2.2fr)]">
        <Node icon={<Laptop className="size-5" />} title="Your agent" sub="Claude Code, Codex, …" plain />
        <Wire live={ready && !failing} />
        <Node
          icon={<img src="/favicon.svg" alt="" className="size-6" />}
          title={status.edition === "mobile" ? "Android server" : "fcc-server"}
          sub={`${displayHost(status.host)}:${status.port}`}
        />
        <Wire live={ready && !failing} />
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3">
          {provider && <ProviderLogo provider={provider} size="lg" />}
          <div className="min-w-0">
            <div className="truncate font-mono text-[15px] font-medium">{modelNameOf(status.model)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>{provider?.display_name ?? status.provider}</span>
              <Pill tone={failing ? "error" : provider ? providerTone(provider) : "idle"}>
                {failing ? "Unavailable" : provider?.label ?? "Unknown"}
              </Pill>
            </div>
          </div>
        </div>
      </div>
      {(!ready || failing) && provider && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-signal/35 bg-amber-signal/8 px-4 py-3 text-sm">
          <AlertTriangle className="size-4.5 shrink-0 text-amber-signal" />
          <span className="flex-1">
            {status.startup.provider_errors?.[status.provider] ??
              `${provider.display_name} needs a key before your agent can use the default model.`}
          </span>
          <Link
            to={`/providers?open=${provider.provider_id}`}
            className="font-medium text-accent hover:underline"
          >
            Set up {provider.display_name}
          </Link>
        </div>
      )}
    </Panel>
  );
}

function Node({ icon, title, sub, plain }: { icon: React.ReactNode; title: string; sub: string; plain?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-raised text-muted">
        {icon}
      </div>
      <div>
        <div className="text-[15px] font-medium">{title}</div>
        <div className={plain ? "text-xs text-faint" : "font-mono text-xs text-faint"}>{sub}</div>
      </div>
    </div>
  );
}

function Wire({ live }: { live: boolean }) {
  return (
    <svg className="hidden h-4 w-full min-w-10 md:block" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden>
      <line
        x1="0"
        y1="8"
        x2="100"
        y2="8"
        stroke={live ? "var(--c-accent)" : "var(--c-line-strong)"}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        className={live ? "cable-live" : undefined}
        strokeDasharray={live ? undefined : "4 5"}
      />
    </svg>
  );
}

function Stat({ value, label, to }: { value: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="group rounded-panel border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between">
        <div className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
        <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-accent" />
      </div>
      <div className="mt-2 text-sm text-muted">{label}</div>
    </Link>
  );
}

function TierSummary() {
  const { data: config } = useConfig();
  const { data: status } = useStatus();
  const lookup = useProviderLookup();
  if (!config || !status) return <Spinner />;
  const get = (k: string) => config.fields.find((f) => f.key === k)?.value as string | null | undefined;
  return (
    <ul className="divide-y divide-line">
      {TIERS.map((t) => {
        const own = get(t.modelKey);
        const model = own ?? status.model;
        return (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <span className="size-2.5 rounded-full" style={{ background: TIER_COLORS[t.id] }} aria-hidden />
            <span className="w-16 text-sm font-medium">{t.name}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{modelNameOf(model)}</span>
            <span className="hidden text-xs text-faint sm:inline">{own ? lookup(providerOf(own))?.display_name ?? providerOf(own) : "inherits default"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function IntegrationsSummary() {
  const results = useQueries({
    queries: INTEGRATIONS.map((id) => ({ queryKey: keys.integration(id), queryFn: () => api.integration(id) })),
  });
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2">
      {INTEGRATIONS.map((id, i) => {
        const r = results[i];
        const connected = !!r.data?.connected;
        return (
          <li key={id} className="flex items-center gap-2.5 py-1.5 text-sm">
            <StatusDot tone={r.isLoading ? "idle" : connected ? "ok" : "idle"} />
            <span className={connected ? "" : "text-muted"}>{INTEGRATION_META[id].name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TermuxPanel({ port }: { port: number }) {
  const cmd = `export ANTHROPIC_BASE_URL=http://127.0.0.1:${port}\nexport ANTHROPIC_AUTH_TOKEN=fcc\nclaude`;
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <TerminalSquare className="size-4.5 text-muted" />
        <h2 className="font-semibold">Use Claude Code on this phone</h2>
      </div>
      <p className="mb-3 max-w-2xl text-sm text-muted">
        Install Claude Code in Termux (<code className="font-mono text-[13px]">pkg install nodejs</code>, then{" "}
        <code className="font-mono text-[13px]">npm i -g @anthropic-ai/claude-code</code>) and start it with:
      </p>
      <div className="flex items-start gap-2 rounded-control border border-line bg-raised p-3">
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] whitespace-pre">{cmd}</pre>
        <CopyButton value={cmd} label="Copy commands" />
      </div>
    </Panel>
  );
}

export function OverviewPage() {
  const { data: status } = useStatus();
  const { data: models } = useModels();
  const refresh = useRefreshModels();
  const mobile = useIsMobileServer();
  const ready = status?.provider_status.filter(isReady) ?? [];
  const total = status?.provider_status.length ?? 0;
  const pending = status?.pending_fields ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Overview</h1>
          <p className="mt-1 text-[15px] text-muted">Your local model router at a glance.</p>
        </div>
        <Button
          variant="secondary"
          busy={refresh.isPending}
          icon={<RefreshCw className="size-4" />}
          onClick={() => refresh.mutate()}
        >
          Refresh models
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-panel border border-amber-signal/40 bg-amber-signal/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4.5 shrink-0 text-amber-signal" />
          Restart fcc-server to use: <span className="font-mono text-[13px]">{pending.join(", ")}</span>
        </div>
      )}

      <SignalPath />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat value={`${ready.length}/${total}`} label="Providers ready" to="/providers" />
        <Stat value={models?.models.length ?? "–"} label="Models in catalog" to="/routing" />
        {mobile ? (
          <Stat value={status?.port ?? "–"} label="Local port for Claude Code" to="/playground" />
        ) : (
          <Stat value={HARNESSES.length + 1} label="Supported coding agents" to="/integrations" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Claude Code tiers</h2>
            <Link to="/routing" className="text-sm text-accent hover:underline">
              Edit routing
            </Link>
          </div>
          <TierSummary />
        </Panel>
        <Panel className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Ready providers</h2>
            <Link to="/providers" className="text-sm text-accent hover:underline">
              Manage
            </Link>
          </div>
          {ready.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              No provider has credentials yet. NVIDIA NIM and OpenRouter both offer free tiers.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ready.slice(0, 7).map((p) => (
                <li key={p.provider_id} className="flex items-center gap-3 py-1">
                  <ProviderLogo provider={p} size="sm" />
                  <span className="flex-1 text-sm">{p.display_name}</span>
                  <Pill tone={providerTone(p)}>{p.label}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {mobile ? <TermuxPanel port={status?.port ?? 8082} /> : (
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TerminalSquare className="size-4.5 text-muted" />
            <h2 className="font-semibold">Launch an agent through FCC</h2>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {HARNESSES.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-control border border-line bg-raised py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px]">{h.command}</span>
                  <span className="block text-xs text-faint">{h.name}</span>
                </span>
                <CopyButton value={h.command} label={`Copy ${h.command}`} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">App integrations</h2>
            <Link to="/integrations" className="text-sm text-accent hover:underline">
              Connect
            </Link>
          </div>
          <IntegrationsSummary />
        </Panel>
      </div>
      )}
    </div>
  );
}
