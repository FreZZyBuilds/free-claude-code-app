import { RefreshCw, Unplug } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStatus } from "@/hooks/data";
import { Button, CopyButton, Panel } from "./ui";

const STEPS = [
  { os: "macOS / Linux", cmd: 'curl -fsSL "https://raw.githubusercontent.com/Alishahryar1/free-claude-code/main/scripts/install.sh" | sh' },
  { os: "Start the server", cmd: "fcc-server" },
];

export function ServerOffline() {
  const qc = useQueryClient();
  const { error, isFetching } = useStatus();
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-5 py-12">
      <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-stop/10 text-stop">
        <Unplug className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Studio can't reach fcc-server</h1>
      <p className="mt-2 text-muted">
        FCC Studio controls a Free Claude Code server running on this computer. Start it, and this page reconnects on
        its own.
      </p>
      {error && <p className="mt-3 font-mono text-[13px] text-stop">{(error as Error).message}</p>}
      <Panel className="mt-6 divide-y divide-line">
        {STEPS.map((s) => (
          <div key={s.os} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-faint">{s.os}</div>
              <code className="block truncate font-mono text-[13px]">{s.cmd}</code>
            </div>
            <CopyButton value={s.cmd} />
          </div>
        ))}
      </Panel>
      <p className="mt-4 text-sm text-muted">
        Running FCC on another port? Start Studio with <code className="font-mono text-[13px]">FCC_URL=http://127.0.0.1:PORT</code>.
      </p>
      <div className="mt-6">
        <Button
          variant="primary"
          busy={isFetching}
          icon={<RefreshCw className="size-4" />}
          onClick={() => qc.invalidateQueries()}
        >
          Retry now
        </Button>
      </div>
    </div>
  );
}
