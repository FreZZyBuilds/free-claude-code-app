/* Wire types for the Free Claude Code Admin API (captured from a running fcc-server). */

export type ProviderKind = "remote" | "local" | "connected_account";
export type ProviderHealth =
  | "configured"
  | "missing_key"
  | "missing_config"
  | "disconnected"
  | "connected"
  | "connecting"
  | "error"
  | (string & {});

export interface ProviderStatus {
  provider_id: string;
  display_name: string;
  website_url?: string | null;
  logo_filename?: string | null;
  kind: ProviderKind;
  status: ProviderHealth;
  label: string;
  configuration_keys?: string[];
  missing_configuration_keys?: string[];
  settings_keys: string[];
}

export interface StartupState {
  generation_id: number;
  catalog_revision: number;
  catalog: string;
  catalog_file: string;
  providers: Record<string, string>;
  provider_errors?: Record<string, string>;
  code?: { state: string; message: string | null };
  messaging?: { state: string; message: string | null; warning?: string | null };
  integrations?: Record<string, { state: string; changed: boolean; message: string | null }>;
}

export interface ServerStatus {
  status: "running" | "stopping" | (string & {});
  instance_id: string;
  startup: StartupState;
  host: string;
  port: number;
  model: string;
  provider: string;
  pending_fields: string[];
  provider_status: ProviderStatus[];
  cached_models: Record<string, unknown>;
}

export type FieldType =
  | "text"
  | "secret"
  | "api_key_list"
  | "boolean"
  | "number"
  | "select"
  | "model"
  | "optional_model"
  | "model_list"
  | "textarea";

export interface ApiKeyListValue {
  revision: string | null;
  entries: { reference: number }[];
}

export interface ConfigField {
  key: string;
  label: string;
  section: string;
  type: FieldType;
  value: string | null | ApiKeyListValue;
  configured: boolean;
  source: string;
  locked: boolean;
  nullable: boolean;
  secret: boolean;
  advanced: boolean;
  restart_required: boolean;
  session_sensitive: boolean;
  options: { value: string; label: string }[];
  description: string;
}

export interface ConfigSection {
  id: string;
  label: string;
  description: string;
  advanced: boolean;
}

export type ApiFormat = "openai_chat" | "openai_responses" | "anthropic_messages";

export interface CustomProvider {
  provider_id: string;
  display_name: string;
  base_url: string;
  api_keys: ApiKeyListValue;
  api_format: ApiFormat;
  reasoning_format: string;
  reasoning_history_format: "disabled" | "reasoning_content" | "reasoning" | "think_tags";
  model_ids: string[];
}

export interface AdminConfig {
  sections: ConfigSection[];
  fields: ConfigField[];
  paths: Record<string, string>;
  provider_status: ProviderStatus[];
  custom_providers: CustomProvider[];
  custom_providers_locked: boolean;
  custom_reasoning_formats: Record<ApiFormat, string[]>;
}

/** What the API key editor sends back: new values or references to keep. */
export interface ApiKeyListMutation {
  revision: string | null;
  entries: ({ value: string } | { retain: number })[];
}

export type ConfigValue = string | null | ApiKeyListMutation | string[];

export interface CredentialCheck {
  key: string;
  index: number;
  status: "verified" | "unverified" | "rejected" | (string & {});
  message?: string;
}

export interface ApplyResult {
  custom_provider_id: string | null;
  applied: boolean;
  valid: boolean;
  errors: string[];
  env_preview?: string;
  path?: string;
  pending_fields: string[];
  restart: { required: boolean; automatic: boolean; admin_url: string | null; fields: string[] };
  credential_checks: CredentialCheck[];
  credential_row_errors?: { key: string; index: number; message: string }[];
}

export interface ModelOptions {
  models: string[];
  model_labels: Record<string, string>;
  failed_providers: string[];
}

export interface ProviderTestResult {
  provider_id: string;
  ok: boolean;
  message?: string;
  models?: string[];
}

export interface LocalProviderStatus {
  provider_id: string;
  status: "reachable" | "offline" | "missing_url";
  label: string;
  base_url: string;
  status_code?: number;
  probe_path: string;
  latency_ms: number | null;
  error_type: string | null;
  message?: string;
}

export interface ConnectedAccountStatus {
  provider_id: string;
  state: "disconnected" | "connecting" | "connected" | "error";
  connected: boolean;
  revision: number;
  attempt_id?: string | null;
  email?: string | null;
  mode?: "browser" | "device" | null;
  authorization_url?: string | null;
  verification_url?: string | null;
  user_code?: string | null;
  expires_at?: number | null;
  model_count?: number | null;
  message?: string | null;
  display_identity?: string | null;
  supported_login_modes: ("browser" | "device")[];
  default_login_mode: "browser" | "device";
}

export interface IntegrationStatus {
  connected?: boolean;
  completed?: boolean;
  available?: boolean;
  disconnect_pending?: boolean;
  message?: string | null;
  paths?: Record<string, string>;
  update?: { state: string; changed: boolean; message: string | null };
  [key: string]: unknown;
}

export interface CodeBootstrap {
  available: boolean;
  message?: string | null;
  harnesses: { id: string; name: string }[];
  models: {
    id: string;
    display_name: string;
    provider_id: string;
    model_name: string;
    reasoning_efforts: string[];
    default_reasoning_effort: string;
    context_window_tokens: number | null;
  }[];
  default_model: string;
}
