/* Static product knowledge the server does not expose: harness launchers and tiers. */

export const HARNESSES = [
  { id: "claude", name: "Claude Code", command: "fcc-claude" },
  { id: "codex", name: "Codex", command: "fcc-codex" },
  { id: "pi", name: "Pi", command: "fcc-pi" },
  { id: "opencode", name: "OpenCode", command: "fcc-opencode" },
  { id: "cline", name: "Cline", command: "fcc-cline" },
  { id: "hermes", name: "Hermes", command: "fcc-hermes" },
  { id: "dsh", name: "DeepSeek Harness", command: "fcc-dsh" },
  { id: "grok", name: "Grok Build", command: "fcc-grok" },
  { id: "muse", name: "Muse Code", command: "fcc-muse" },
  { id: "aider", name: "Aider", command: "fcc-aider" },
  { id: "agy", name: "Antigravity CLI", command: "fcc-agy" },
] as const;

/** Claude Code model tiers and the routing/effort keys that control them. */
export const TIERS = [
  { id: "fable", name: "Fable", modelKey: "MODEL_FABLE", effortKey: "REASONING_FABLE", probe: "claude-fable-5-2" },
  { id: "opus", name: "Opus", modelKey: "MODEL_OPUS", effortKey: "REASONING_OPUS", probe: "claude-opus-5-5" },
  { id: "sonnet", name: "Sonnet", modelKey: "MODEL_SONNET", effortKey: "REASONING_SONNET", probe: "claude-sonnet-5-5" },
  { id: "haiku", name: "Haiku", modelKey: "MODEL_HAIKU", effortKey: "REASONING_HAIKU", probe: "claude-haiku-5-5" },
] as const;

export const TIER_COLORS: Record<string, string> = {
  default: "#3651F5",
  fable: "#C2477E",
  opus: "#E8A23A",
  sonnet: "#18A07E",
  haiku: "#2F9BD6",
};

export const INTEGRATION_META: Record<string, { name: string; blurb: string; group: "Desktop" | "IDE" | "CLI" }> = {
  "claude-desktop": { name: "Claude Desktop", blurb: "Adds an FCC profile to the Claude desktop app's third-party config library.", group: "Desktop" },
  "claude-vscode": { name: "Claude Code for VS Code", blurb: "Points the Claude Code extension at FCC.", group: "IDE" },
  "vscode-chat": { name: "VS Code Chat", blurb: "Registers FCC models as a language-model provider in VS Code Chat.", group: "IDE" },
  "jetbrains-acp": { name: "JetBrains (ACP)", blurb: "Connects JetBrains AI Assistant through the Agent Client Protocol.", group: "IDE" },
  codex: { name: "Codex", blurb: "Writes an FCC provider into ~/.codex/config.toml for the Codex CLI and app.", group: "CLI" },
  "dsh-desktop": { name: "DeepSeek Desktop", blurb: "Routes DeepSeek Desktop through FCC.", group: "Desktop" },
  antigravity: { name: "Antigravity", blurb: "Connects Google Antigravity to FCC models.", group: "IDE" },
};

export function providerOf(modelRef: string | null | undefined): string | null {
  if (!modelRef) return null;
  const i = modelRef.indexOf("/");
  return i > 0 ? modelRef.slice(0, i) : null;
}

export function modelNameOf(modelRef: string): string {
  const i = modelRef.indexOf("/");
  return i > 0 ? modelRef.slice(i + 1) : modelRef;
}
