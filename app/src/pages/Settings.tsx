import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";
import { FileText } from "lucide-react";
import { useApply, useConfig } from "@/hooks/data";
import type { AdminConfig } from "@/lib/types";
import { FieldControl, type Drafts } from "@/components/FieldControl";
import { Button, CopyButton, PageHeader, Panel, Spinner, Switch, cx } from "@/components/ui";

/* Providers and model routing have their own pages. */
const HIDDEN = new Set(["providers", "models"]);

export function SettingsPage() {
  const { data: config, isLoading } = useConfig();
  if (isLoading || !config) return <Spinner />;
  return <SettingsEditor config={config} />;
}

function SettingsEditor({ config }: { config: AdminConfig }) {
  const params = useParams();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const sections = config.sections.filter((s) => !HIDDEN.has(s.id) && (showAdvanced || !s.advanced));
  const active = sections.find((s) => s.id === params.section) ?? sections[0];
  const [drafts, setDrafts] = useState<Drafts>({});
  const apply = useApply();

  const fields = useMemo(
    () => config.fields.filter((f) => f.section === active?.id && (showAdvanced || !f.advanced)),
    [config, active, showAdvanced],
  );
  const dirty = Object.keys(drafts).length;
  const dirtyBySection = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of Object.keys(drafts)) {
      const s = config.fields.find((f) => f.key === k)?.section;
      if (s) out[s] = (out[s] ?? 0) + 1;
    }
    return out;
  }, [drafts, config]);

  return (
    <div className="pb-24">
      <PageHeader
        title="Settings"
        description="Server, messaging, voice and web tool options. Changes marked Restart take effect after fcc-server restarts."
        actions={
          <label className="flex items-center gap-2 text-sm text-muted">
            Show advanced
            <Switch label="Show advanced settings" checked={showAdvanced} onChange={setShowAdvanced} />
          </label>
        }
      />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {sections.map((s) => (
            <NavLink
              key={s.id}
              to={`/settings/${s.id}`}
              className={() =>
                cx(
                  "flex h-9 shrink-0 items-center justify-between gap-2 rounded-control px-3 text-sm font-medium transition-colors",
                  s.id === active?.id ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg",
                )
              }
            >
              {s.label}
              {dirtyBySection[s.id] && <span className="size-1.5 rounded-full bg-amber-signal" aria-label="unsaved" />}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {active && (
            <Panel className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">{active.label}</h2>
              <p className="mt-1 mb-6 text-sm text-muted">{active.description}</p>
              <div className="grid gap-6 xl:grid-cols-2">
                {fields.map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    draft={drafts[f.key]}
                    onDraft={(v) =>
                      setDrafts((d) => {
                        const n = { ...d };
                        if (v === undefined) delete n[f.key];
                        else n[f.key] = v;
                        return n;
                      })
                    }
                  />
                ))}
              </div>
            </Panel>
          )}
          {config.paths.managed && (
            <Panel className="flex items-center gap-3 px-5 py-3.5">
              <FileText className="size-4.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-faint">Settings file</div>
                <code className="block truncate font-mono text-[13px]">{config.paths.managed}</code>
              </div>
              <CopyButton value={config.paths.managed} label="Copy path" />
            </Panel>
          )}
        </div>
      </div>

      {dirty > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:left-64">
          <div className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-5 shadow-xl">
            <span className="text-sm">
              {dirty} unsaved change{dirty === 1 ? "" : "s"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setDrafts({})}>
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="rounded-full"
              busy={apply.isPending}
              onClick={() => apply.mutate(drafts, { onSuccess: (r) => r.applied && setDrafts({}) })}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
