import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FileCode2, Link2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { keys } from "@/hooks/data";
import { api, INTEGRATIONS, type IntegrationId } from "@/lib/api";
import { HARNESSES, INTEGRATION_META } from "@/lib/catalog";
import type { IntegrationStatus } from "@/lib/types";
import { Button, CopyButton, PageHeader, Panel, Pill, Spinner } from "@/components/ui";

function IntegrationCard({ id }: { id: IntegrationId }) {
  const qc = useQueryClient();
  const meta = INTEGRATION_META[id];
  const q = useQuery({ queryKey: keys.integration(id), queryFn: () => api.integration(id) });
  const act = useMutation({
    mutationFn: (action: "connect" | "disconnect" | "refresh") => api.integrationAction(id, action),
    onSuccess: (data, action) => {
      qc.setQueryData(keys.integration(id), data);
      void qc.invalidateQueries({ queryKey: keys.status });
      const verb = { connect: "Connected", disconnect: "Disconnected", refresh: "Refreshed" }[action];
      toast.success(`${verb} ${meta.name}`, { description: (data.message as string | undefined) ?? undefined });
    },
    onError: (e) => toast.error(`${meta.name}: action failed`, { description: (e as Error).message }),
  });

  const d: IntegrationStatus | undefined = q.data;
  const unavailable = d?.available === false;
  const connected = !!d?.connected;

  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-faint">{meta.group}</div>
          <h3 className="mt-0.5 font-semibold">{meta.name}</h3>
        </div>
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <Pill tone="error">Error</Pill>
        ) : unavailable ? (
          <Pill tone="idle">Not installed</Pill>
        ) : connected ? (
          <Pill tone="ok">Connected</Pill>
        ) : d?.disconnect_pending ? (
          <Pill tone="warn">Disconnect pending</Pill>
        ) : (
          <Pill tone="idle">Not connected</Pill>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{meta.blurb}</p>
      {(d?.message || q.error) && (
        <p className="mt-2 text-[13px] text-muted">{(q.error as Error | null)?.message ?? (d?.message as string)}</p>
      )}
      {d?.update?.message && <p className="mt-2 text-[13px] text-amber-signal">{d.update.message}</p>}
      {d?.paths && Object.keys(d.paths).length > 0 && (
        <details className="mt-3 text-[13px]">
          <summary className="flex cursor-pointer items-center gap-1.5 text-muted hover:text-fg">
            <FileCode2 className="size-3.5" /> Files FCC manages
          </summary>
          <ul className="mt-2 space-y-1">
            {Object.entries(d.paths).map(([k, p]) => (
              <li key={k} className="flex items-center gap-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-faint" title={p}>
                  {p}
                </code>
                <CopyButton value={p} label="Copy path" className="size-7" />
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {connected ? (
          <>
            <Button size="sm" busy={act.isPending && act.variables === "refresh"} icon={<RefreshCw className="size-3.5" />} onClick={() => act.mutate("refresh")}>
              Refresh
            </Button>
            <Button size="sm" variant="danger" busy={act.isPending && act.variables === "disconnect"} icon={<Unlink className="size-3.5" />} onClick={() => act.mutate("disconnect")}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={unavailable || q.isLoading}
            busy={act.isPending && act.variables === "connect"}
            icon={<Link2 className="size-3.5" />}
            onClick={() => act.mutate("connect")}
          >
            Connect
          </Button>
        )}
      </div>
    </Panel>
  );
}

function ClaudeOnboarding() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["onboarding"], queryFn: api.onboarding });
  const done = useMutation({
    mutationFn: api.completeOnboarding,
    onSuccess: (d) => {
      qc.setQueryData(["onboarding"], d);
      toast.success("Claude Code onboarding skipped");
    },
    onError: (e) => toast.error("Could not update Claude Code", { description: (e as Error).message }),
  });
  if (!q.data) return null;
  return (
    <Panel className="flex flex-wrap items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">Claude Code first-run</h3>
        <p className="mt-1 text-sm text-muted">
          Claude Code shows an Anthropic login on first start. Mark onboarding complete so it starts straight into FCC.
        </p>
      </div>
      {q.data.completed ? (
        <Pill tone="ok">
          <CheckCircle2 className="size-3" /> Completed
        </Pill>
      ) : (
        <Button variant="primary" busy={done.isPending} onClick={() => done.mutate()}>
          Skip Anthropic login
        </Button>
      )}
    </Panel>
  );
}

export function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Wire desktop apps and IDEs to FCC with one click. FCC edits their config files and can undo it."
      />
      <ClaudeOnboarding />
      <section>
        <h2 className="mb-3 font-semibold">Apps &amp; IDEs</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((id) => (
            <IntegrationCard key={id} id={id} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-1 font-semibold">Terminal agents</h2>
        <p className="mb-3 text-sm text-muted">These launchers start each agent already pointed at FCC.</p>
        <Panel className="divide-y divide-line">
          {HARNESSES.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-40 shrink-0 text-sm font-medium">{h.name}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted">{h.command}</code>
              <CopyButton value={h.command} label={`Copy ${h.command}`} />
            </div>
          ))}
        </Panel>
        <a
          href="/admin/code"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Open native Code sessions in the browser <ExternalLink className="size-3.5" />
        </a>
      </section>
    </div>
  );
}
