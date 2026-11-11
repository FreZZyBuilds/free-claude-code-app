import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ExternalLink, Plus, Search, Server } from "lucide-react";
import { providerTone, useConfig } from "@/hooks/data";
import type { ProviderStatus } from "@/lib/types";
import { ProviderLogo } from "@/components/ProviderLogo";
import { ProviderDrawer } from "@/components/ProviderDrawer";
import { CustomProviderDrawer } from "@/components/CustomProviderDrawer";
import { Button, EmptyState, Input, PageHeader, Pill, Spinner, cx } from "@/components/ui";

type Filter = "all" | "ready" | "setup" | "local" | "account" | "custom";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "setup", label: "Needs setup" },
  { id: "local", label: "Local" },
  { id: "account", label: "Account login" },
  { id: "custom", label: "Custom" },
];

function matches(p: ProviderStatus, f: Filter, custom: Set<string>) {
  switch (f) {
    case "ready":
      return p.status === "configured" || p.status === "connected";
    case "setup":
      return p.status !== "configured" && p.status !== "connected";
    case "local":
      return p.kind === "local";
    case "account":
      return p.kind === "connected_account";
    case "custom":
      return custom.has(p.provider_id);
    default:
      return true;
  }
}

export function ProvidersPage() {
  const { data: config, isLoading } = useConfig();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const openId = params.get("open");
  const customParam = params.get("custom");

  const customIds = useMemo(() => new Set(config?.custom_providers.map((c) => c.provider_id)), [config]);

  const providers = useMemo(() => {
    if (!config) return [];
    const q = query.trim().toLowerCase();
    const customList: ProviderStatus[] = config.custom_providers
      .filter((c) => !config.provider_status.some((p) => p.provider_id === c.provider_id))
      .map((c) => ({
        provider_id: c.provider_id,
        display_name: c.display_name,
        kind: "remote",
        status: c.api_keys.entries.length ? "configured" : "missing_key",
        label: c.api_keys.entries.length ? "Configured" : "No key",
        settings_keys: [],
        website_url: c.base_url,
      }));
    const rank = (p: ProviderStatus) => (p.status === "configured" || p.status === "connected" ? 0 : 1);
    return [...config.provider_status, ...customList]
      .filter((p) => matches(p, filter, customIds))
      .filter((p) => !q || p.display_name.toLowerCase().includes(q) || p.provider_id.includes(q))
      .sort((a, b) => rank(a) - rank(b));
  }, [config, query, filter, customIds]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, ready: 0, setup: 0, local: 0, account: 0, custom: 0 };
    const all = config ? [...config.provider_status] : [];
    for (const f of FILTERS) c[f.id] = all.filter((p) => matches(p, f.id, customIds)).length;
    if (config) c.custom = config.custom_providers.length;
    if (config) c.all = all.length + config.custom_providers.filter((x) => !all.some((p) => p.provider_id === x.provider_id)).length;
    return c;
  }, [config, customIds]);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", id);
    else next.delete("open");
    next.delete("custom");
    setParams(next, { replace: true });
  };

  const openCustom = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("custom", id);
    else next.delete("custom");
    next.delete("open");
    setParams(next, { replace: true });
  };

  if (isLoading || !config) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Add keys, sign in to accounts, or point FCC at a local server. Several keys per provider rotate automatically when one is rate limited."
        actions={
          !config.custom_providers_locked && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openCustom("new")}>
              Custom provider
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input
            aria-label="Search providers"
            placeholder="Search 60+ providers"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div role="tablist" aria-label="Filter providers" className="scrollbar-thin flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                filter === f.id ? "bg-fg text-canvas" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              {f.label}
              <span className={cx("tabular-nums", filter === f.id ? "opacity-70" : "text-faint")}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {providers.length === 0 ? (
        <EmptyState icon={<Server className="size-8" />} title="No providers match">
          Try another search or filter.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => {
            const isCustom = customIds.has(p.provider_id);
            return (
              <li key={p.provider_id}>
                <button
                  onClick={() => (isCustom ? openCustom(p.provider_id) : open(p.provider_id))}
                  className="flex w-full items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-line-strong hover:bg-raised"
                >
                  <ProviderLogo provider={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.display_name}</span>
                    <span className="block truncate text-xs text-faint">
                      {isCustom ? "Custom endpoint" : p.kind === "local" ? "Runs on your machine" : p.kind === "connected_account" ? "Sign in with account" : hostOf(p.website_url)}
                    </span>
                  </span>
                  <Pill tone={providerTone(p)}>{p.label}</Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-[13px] text-faint">
        Free-tier limits are set by each provider and can change.
        <a
          className="inline-flex items-center gap-1 text-accent hover:underline"
          href="https://github.com/Alishahryar1/free-claude-code#choose-a-provider"
          target="_blank"
          rel="noreferrer"
        >
          Provider guide <ExternalLink className="size-3" />
        </a>
      </p>

      <ProviderDrawer providerId={openId && !customIds.has(openId) ? openId : null} onClose={() => open(null)} />
      <CustomProviderDrawer target={customParam} onClose={() => openCustom(null)} />
    </div>
  );
}

function hostOf(url?: string | null) {
  if (!url) return "";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
