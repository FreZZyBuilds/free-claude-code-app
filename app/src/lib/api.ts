import type {
  AdminConfig,
  ApplyResult,
  CodeBootstrap,
  ConfigValue,
  ConnectedAccountStatus,
  CustomProvider,
  IntegrationStatus,
  LocalProviderStatus,
  ModelOptions,
  ProviderTestResult,
  ServerStatus,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("FCC server is not reachable.", 0);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
      else if (Array.isArray(payload.detail)) detail = payload.detail.map((d) => d?.msg ?? "").join("; ");
    } catch {
      /* non-JSON error page: status text is still useful */
    }
    throw new ApiError(detail || `${response.status} ${response.statusText}`, response.status);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown = {}) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export type CustomProviderMutation =
  | { action: "create"; values: Record<string, unknown> }
  | { action: "update"; provider_id: string; values: Record<string, unknown> }
  | { action: "delete"; provider_id: string; values: Record<string, never> };

/** Integrations the server can wire up for a local client. */
export const INTEGRATIONS = [
  "claude-desktop",
  "claude-vscode",
  "vscode-chat",
  "codex",
  "dsh-desktop",
  "jetbrains-acp",
  "antigravity",
] as const;
export type IntegrationId = (typeof INTEGRATIONS)[number];

export const api = {
  health: () => request<{ status: string }>("/health"),
  status: () => request<ServerStatus>("/admin/api/status"),
  config: () => request<AdminConfig>("/admin/api/config"),
  apply: (values: Record<string, ConfigValue>) => post<ApplyResult>("/admin/api/config/apply", { values }),
  customProvider: (mutation: CustomProviderMutation) =>
    post<ApplyResult>("/admin/api/config/apply", { custom_provider: mutation }),
  models: () => request<ModelOptions>("/admin/api/models"),
  refreshModels: () => post<ModelOptions>("/admin/api/models/refresh"),
  testProvider: (id: string) => post<ProviderTestResult>(`/admin/api/providers/${id}/test`),
  localStatus: (id: string) => request<LocalProviderStatus>(`/admin/api/providers/${id}/local-status`),
  account: (id: string) => request<ConnectedAccountStatus>(`/admin/api/providers/${id}/auth`),
  accountLogin: (id: string, mode?: "browser" | "device") =>
    post<ConnectedAccountStatus>(`/admin/api/providers/${id}/auth/login`, mode ? { mode } : {}),
  accountCancel: (id: string) => post<ConnectedAccountStatus>(`/admin/api/providers/${id}/auth/cancel`),
  accountDisconnect: (id: string) =>
    request<ConnectedAccountStatus>(`/admin/api/providers/${id}/auth`, { method: "DELETE" }),
  integration: (id: IntegrationId) => request<IntegrationStatus>(`/admin/api/integrations/${id}`),
  integrationAction: (id: IntegrationId, action: "connect" | "disconnect" | "refresh") =>
    post<IntegrationStatus>(`/admin/api/integrations/${id}/${action}`),
  onboarding: () => request<IntegrationStatus>("/admin/api/integrations/claude-onboarding"),
  completeOnboarding: () => post<IntegrationStatus>("/admin/api/integrations/claude-onboarding/complete"),
  codeBootstrap: () => request<CodeBootstrap>("/admin/api/code/bootstrap"),
};

export type { CustomProvider };
