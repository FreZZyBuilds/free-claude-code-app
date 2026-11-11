import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ExternalLink, Gauge, LogIn, LogOut, XCircle } from "lucide-react";
import { toast } from "sonner";
import { keys, providerTone, reportApply, useConfig } from "@/hooks/data";
import { api } from "@/lib/api";
import type { ConfigField, ConfigValue, ProviderTestResult } from "@/lib/types";
import { ApiKeyListEditor, keyRowsPayload, rowsFromValue, validateKeyRows, type KeyRow } from "./ApiKeyListEditor";
import { FieldControl, type Drafts } from "./FieldControl";
import { ProviderLogo } from "./ProviderLogo";
import { Button, CopyButton, Drawer, FieldShell, Pill, Spinner } from "./ui";

export function ProviderDrawer({ providerId, onClose }: { providerId: string | null; onClose: () => void }) {
  const { data: config } = useConfig();
  const provider = config?.provider_status.find((p) => p.provider_id === providerId);
  return (
    <Drawer
      open={!!provider}
      onClose={onClose}
      title={provider?.display_name}
      icon={provider && <ProviderLogo provider={provider} size="lg" />}
      subtitle={
        provider && (
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={providerTone(provider)}>{provider.label}</Pill>
            {provider.website_url && (
              <a
                href={provider.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                Get access <ExternalLink className="size-3" />
              </a>
            )}
          </span>
        )
      }
    >
      {provider && config && <ProviderBody key={provider.provider_id} providerId={provider.provider_id} onDone={onClose} />}
    </Drawer>
  );
}

function ProviderBody({ providerId, onDone }: { providerId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: config } = useConfig();
  const provider = config!.provider_status.find((p) => p.provider_id === providerId)!;
  const fields = useMemo(
    () =>
      provider.settings_keys
        .map((k) => config!.fields.find((f) => f.key === k))
        .filter((f): f is ConfigField => !!f),
    [config, provider],
  );
  const keyFields = fields.filter((f) => f.type === "api_key_list");
  const basic = fields.filter((f) => f.type !== "api_key_list" && !f.advanced);
  const advanced = fields.filter((f) => f.type !== "api_key_list" && f.advanced);

  const [drafts, setDrafts] = useState<Drafts>({});
  const [keyRows, setKeyRows] = useState<Record<string, KeyRow[]>>(() =>
    Object.fromEntries(keyFields.map((f) => [f.key, rowsFromValue(f.value as never)])),
  );
  const [keyErrors, setKeyErrors] = useState<Record<string, Record<number, string> | null>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [test, setTest] = useState<ProviderTestResult | null>(null);

  const keyChanged = (f: ConfigField) => {
    const original = (f.value as { entries: { reference: number }[] } | null)?.entries ?? [];
    const rows = keyRows[f.key] ?? [];
    return (
      rows.length !== original.length ||
      rows.some((r, i) => r.value.trim() !== "" || r.reference !== original[i]?.reference)
    );
  };
  const dirty = Object.keys(drafts).length > 0 || keyFields.some(keyChanged);

  const save = useMutation({
    mutationFn: async () => {
      const values: Record<string, ConfigValue> = { ...drafts };
      const errs: Record<string, Record<number, string> | null> = {};
      let invalid = false;
      for (const f of keyFields) {
        if (!keyChanged(f)) continue;
        errs[f.key] = validateKeyRows(keyRows[f.key]);
        if (errs[f.key]) invalid = true;
        const revision = (f.value as { revision: string | null } | null)?.revision ?? null;
        values[f.key] = keyRowsPayload(revision, keyRows[f.key]);
      }
      setKeyErrors(errs);
      if (invalid) throw new Error("Check the highlighted key rows.");
      return api.apply(values);
    },
    onSuccess: async (result) => {
      if (!result.applied) {
        const errs: Record<string, Record<number, string>> = {};
        for (const r of result.credential_row_errors ?? []) (errs[r.key] ??= {})[r.index] = r.message;
        for (const c of result.credential_checks.filter((c) => c.status === "rejected"))
          (errs[c.key] ??= {})[c.index] = c.message ?? "Rejected by the provider.";
        setKeyErrors(errs);
        reportApply(result);
        return;
      }
      reportApply(result);
      await qc.invalidateQueries();
      onDone();
    },
    onError: (e) => toast.error("Could not save", { description: (e as Error).message }),
  });

  const runTest = useMutation({
    mutationFn: () => api.testProvider(providerId),
    onSuccess: (r) => {
      setTest(r);
      if (r.ok) void qc.invalidateQueries({ queryKey: keys.models });
      void qc.invalidateQueries({ queryKey: keys.status });
    },
    onError: (e) => setTest({ provider_id: providerId, ok: false, message: (e as Error).message }),
  });

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6">
        {provider.kind === "connected_account" && <AccountPanel providerId={providerId} />}
        {provider.kind === "local" && <LocalProbe providerId={providerId} />}

        {keyFields.map((f) => (
          <FieldShell key={f.key} label={f.label} description={f.description}>
            <ApiKeyListEditor
              label={f.label}
              rows={keyRows[f.key] ?? []}
              disabled={f.locked}
              errors={keyErrors[f.key]}
              onChange={(rows) => {
                setKeyRows((s) => ({ ...s, [f.key]: rows }));
                setKeyErrors((s) => ({ ...s, [f.key]: null }));
              }}
            />
          </FieldShell>
        ))}

        {basic.map((f) => (
          <FieldControl
            key={f.key}
            field={f}
            draft={drafts[f.key]}
            onDraft={(v) => setDrafts((d) => withDraft(d, f.key, v))}
          />
        ))}

        {advanced.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
            >
              <ChevronDown className={`size-4 transition-transform ${showAdvanced ? "" : "-rotate-90"}`} />
              Network &amp; advanced
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-5">
                {advanced.map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    draft={drafts[f.key]}
                    onDraft={(v) => setDrafts((d) => withDraft(d, f.key, v))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {test && (
          <div
            role="status"
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
              test.ok ? "border-go/30 bg-go/8" : "border-stop/30 bg-stop/8"
            }`}
          >
            {test.ok ? (
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-go" />
            ) : (
              <XCircle className="mt-0.5 size-4.5 shrink-0 text-stop" />
            )}
            <span>
              {test.ok
                ? `Connected. ${test.models?.length ?? 0} model${test.models?.length === 1 ? "" : "s"} available.`
                : test.message ?? "The provider check failed."}
            </span>
          </div>
        )}
      </div>

      {(fields.length > 0 || provider.kind !== "connected_account") && (
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3">
        <Button
          variant="secondary"
          busy={runTest.isPending}
          disabled={dirty}
          title={dirty ? "Save first, then test the saved settings" : undefined}
          icon={<Gauge className="size-4" />}
          onClick={() => runTest.mutate()}
        >
          Test connection
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty} busy={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
      )}
    </div>
  );
}

function withDraft(d: Drafts, key: string, v: ConfigValue | undefined): Drafts {
  const next = { ...d };
  if (v === undefined) delete next[key];
  else next[key] = v;
  return next;
}

function LocalProbe({ providerId }: { providerId: string }) {
  const q = useQuery({ queryKey: keys.local(providerId), queryFn: () => api.localStatus(providerId), retry: false });
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  if (!d) return null;
  const tone = d.status === "reachable" ? "ok" : d.status === "missing_url" ? "warn" : "error";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
      <Pill tone={tone}>{d.label}</Pill>
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted">
        {d.status === "missing_url" ? "Set a base URL below" : `GET ${d.base_url}${d.probe_path}`}
      </span>
      {d.latency_ms != null && <span className="text-xs text-faint tabular-nums">{Math.round(d.latency_ms)} ms</span>}
      <Button size="sm" variant="ghost" busy={q.isFetching} onClick={() => q.refetch()}>
        Recheck
      </Button>
    </div>
  );
}

function AccountPanel({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: keys.account(providerId),
    queryFn: () => api.account(providerId),
    refetchInterval: (query) => (query.state.data?.state === "connecting" ? 2000 : false),
  });
  const a = q.data;
  const [mode, setMode] = useState<"browser" | "device" | undefined>();
  const set = (data: typeof a) => {
    qc.setQueryData(keys.account(providerId), data);
    void qc.invalidateQueries({ queryKey: keys.status });
    void qc.invalidateQueries({ queryKey: keys.config });
  };
  const login = useMutation({
    mutationFn: () => api.accountLogin(providerId, mode ?? a?.default_login_mode),
    onSuccess: (d) => {
      set(d);
      if (d.authorization_url) window.open(d.authorization_url, "_blank", "noopener");
    },
    onError: (e) => toast.error("Sign-in could not start", { description: (e as Error).message }),
  });
  const cancel = useMutation({ mutationFn: () => api.accountCancel(providerId), onSuccess: set });
  const disconnect = useMutation({
    mutationFn: () => api.accountDisconnect(providerId),
    onSuccess: (d) => {
      set(d);
      toast.success("Signed out");
    },
  });

  const previous = useRef(a?.state);
  useEffect(() => {
    if (a?.state === "connected" && previous.current === "connecting") toast.success("Account connected");
    previous.current = a?.state;
  }, [a?.state]);

  if (!a) return <Spinner />;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-raised p-4">
      <div className="flex items-center gap-3">
        <Pill tone={a.connected ? "ok" : a.state === "connecting" ? "info" : a.state === "error" ? "error" : "idle"}>
          {a.connected ? "Connected" : a.state === "connecting" ? "Waiting for sign-in" : a.state === "error" ? "Error" : "Not connected"}
        </Pill>
        {(a.display_identity || a.email) && <span className="truncate text-sm">{a.display_identity ?? a.email}</span>}
        {a.model_count != null && a.connected && (
          <span className="ml-auto text-xs text-faint">{a.model_count} models</span>
        )}
      </div>

      {a.state === "connecting" && a.user_code && (
        <div className="rounded-lg border border-cobalt-500/25 bg-accent-soft p-4">
          <p className="text-sm">
            Open{" "}
            <a href={a.verification_url ?? "#"} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
              {a.verification_url}
            </a>{" "}
            and enter this code:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="font-mono text-2xl font-semibold tracking-[0.18em]">{a.user_code}</code>
            <CopyButton value={a.user_code} label="Copy code" />
          </div>
        </div>
      )}
      {a.state === "connecting" && a.authorization_url && !a.user_code && (
        <p className="text-sm text-muted">
          Finish signing in in the browser tab that opened.{" "}
          <a href={a.authorization_url} target="_blank" rel="noreferrer" className="text-accent underline">
            Open it again
          </a>
        </p>
      )}
      {a.message && <p className="text-sm text-muted">{a.message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!a.connected && a.state !== "connecting" && a.supported_login_modes.length > 1 && (
          <select
            aria-label="Sign-in method"
            className="h-8 rounded-control border border-line-strong bg-surface px-2 text-[13px]"
            value={mode ?? a.default_login_mode}
            onChange={(e) => setMode(e.target.value as "browser" | "device")}
          >
            {a.supported_login_modes.map((m) => (
              <option key={m} value={m}>
                {m === "browser" ? "Browser sign-in" : "Device code"}
              </option>
            ))}
          </select>
        )}
        {!a.connected && a.state !== "connecting" && (
          <Button size="sm" variant="primary" busy={login.isPending} icon={<LogIn className="size-4" />} onClick={() => login.mutate()}>
            Sign in
          </Button>
        )}
        {a.state === "connecting" && (
          <Button size="sm" busy={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel sign-in
          </Button>
        )}
        {a.connected && (
          <Button
            size="sm"
            variant="danger"
            busy={disconnect.isPending}
            icon={<LogOut className="size-4" />}
            onClick={() => disconnect.mutate()}
          >
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
}
