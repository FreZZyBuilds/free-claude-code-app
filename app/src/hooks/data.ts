import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ApplyResult, ConfigValue, ProviderStatus } from "@/lib/types";
import type { Tone } from "@/components/ui";

export const keys = {
  status: ["status"] as const,
  config: ["config"] as const,
  models: ["models"] as const,
  account: (id: string) => ["account", id] as const,
  local: (id: string) => ["local", id] as const,
  integration: (id: string) => ["integration", id] as const,
};

export function useStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: api.status,
    refetchInterval: (q) => (q.state.error ? 2500 : 6000),
    retry: false,
  });
}

export function useConfig() {
  return useQuery({ queryKey: keys.config, queryFn: api.config, staleTime: 15_000 });
}

export function useModels() {
  return useQuery({ queryKey: keys.models, queryFn: api.models, staleTime: 60_000 });
}

export function useRefreshModels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refreshModels,
    onSuccess: (data) => {
      qc.setQueryData(keys.models, data);
      const failed = data.failed_providers.length;
      toast.success(`${data.models.length} models discovered`, {
        description: failed ? `${failed} provider${failed === 1 ? "" : "s"} could not be listed.` : undefined,
      });
    },
    onError: (e) => toast.error("Model refresh failed", { description: (e as Error).message }),
  });
}

async function waitForRestart(previousInstance: string | undefined): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    try {
      const s = await api.status();
      if (s.status === "running" && s.instance_id !== previousInstance) return;
    } catch {
      /* server is restarting */
    }
  }
  throw new ApiError("FCC did not come back after the restart. Check the server terminal.", 0);
}

/** Summarise an apply result into a toast, following the restart contract of the server. */
export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, ConfigValue>): Promise<ApplyResult> => {
      const before = qc.getQueryData<{ instance_id: string }>(keys.status)?.instance_id;
      const result = await api.apply(values);
      if (result.applied && result.restart.required && result.restart.automatic) {
        toast.loading("Restarting FCC…", { id: "restart" });
        await waitForRestart(before);
        toast.success("FCC restarted with the new settings", { id: "restart" });
      }
      return result;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries();
      reportApply(result);
    },
    onError: (e) => toast.error("Could not apply settings", { description: (e as Error).message }),
  });
}

export function reportApply(result: ApplyResult) {
  if (!result.applied) {
    const rows = (result.credential_row_errors ?? []).map((r) => `Key ${r.index + 1}: ${r.message}`);
    toast.error("Not applied", { description: [...result.errors, ...rows].join("\n") || "The server rejected the change." });
    return;
  }
  const unverified = result.credential_checks.filter((c) => c.status === "unverified");
  const pending = result.restart.required && !result.restart.automatic ? result.restart.fields : result.pending_fields;
  if (pending.length) {
    toast.warning("Saved — restart fcc-server to use", { description: pending.join(", ") });
  } else if (unverified.length) {
    toast.warning("Saved, some keys could not be verified", {
      description: unverified.map((c) => `Key ${c.index + 1}: ${c.message ?? ""}`).join("\n"),
    });
  } else {
    toast.success("Changes applied");
  }
}

export function providerTone(p: Pick<ProviderStatus, "status">): Tone {
  switch (p.status) {
    case "configured":
    case "connected":
      return "ok";
    case "connecting":
      return "info";
    case "error":
    case "failed":
      return "error";
    case "missing_config":
      return "warn";
    default:
      return "idle";
  }
}

export function isReady(p: ProviderStatus) {
  return p.status === "configured" || p.status === "connected";
}

/** Resolve built-in and custom providers by id (custom ones are absent from provider_status). */
export function useProviderLookup() {
  const { data: config } = useConfig();
  const { data: status } = useStatus();
  return (id: string | null | undefined): ProviderStatus | undefined => {
    if (!id) return undefined;
    const list = config?.provider_status ?? status?.provider_status ?? [];
    const builtIn = list.find((p) => p.provider_id === id);
    if (builtIn) return builtIn;
    const c = config?.custom_providers.find((x) => x.provider_id === id);
    if (!c) return undefined;
    return {
      provider_id: c.provider_id,
      display_name: c.display_name,
      kind: "remote",
      logo_filename: null,
      website_url: c.base_url,
      status: "configured",
      label: "Custom",
      settings_keys: [],
    };
  };
}

export const displayHost = (host: string) => (host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host);
