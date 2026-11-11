/* Minimal Anthropic Messages streaming client for FCC's /v1/messages endpoint. */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface StreamHandlers {
  onText?: (delta: string) => void;
  onThinking?: (delta: string) => void;
  onStart?: (info: { model?: string; id?: string }) => void;
  onUsage?: (usage: StreamUsage) => void;
  onStop?: (reason: string | null) => void;
}

export interface StreamRequest {
  model: string;
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  thinking?: boolean;
  token?: string;
  signal?: AbortSignal;
}

export class StreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { error?: { message?: unknown }; detail?: unknown; message?: unknown };
  if (p.error && typeof p.error.message === "string") return p.error.message;
  if (typeof p.detail === "string") return p.detail;
  if (typeof p.message === "string") return p.message;
  return null;
}

/** Split an SSE byte stream into `{event, data}` frames. Exported for tests. */
export function* parseSseFrames(buffer: string): Generator<{ event: string; data: string }, string> {
  let rest = buffer;
  for (;;) {
    const match = /\r?\n\r?\n/.exec(rest);
    if (!match) return rest;
    const raw = rest.slice(0, match.index);
    rest = rest.slice(match.index + match[0].length);
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length) yield { event, data: data.join("\n") };
  }
}

export async function streamMessage(req: StreamRequest, handlers: StreamHandlers): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (req.token) headers["x-api-key"] = req.token;

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    stream: true,
    messages: req.messages,
  };
  if (req.system?.trim()) body.system = req.system;
  if (req.thinking) body.thinking = { type: "enabled", budget_tokens: Math.min(2048, (req.maxTokens ?? 4096) - 1) };

  let response: Response;
  try {
    response = await fetch("/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new StreamError("FCC server is not reachable.", 0);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/event-stream")) {
    let message = `${response.status} ${response.statusText}`;
    try {
      message = errorMessage(await response.json()) ?? message;
    } catch {
      /* keep status text */
    }
    throw new StreamError(message, response.status);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = parseSseFrames(buffer);
    let next = frames.next();
    while (!next.done) {
      handleFrame(next.value.data, handlers);
      next = frames.next();
    }
    buffer = next.value;
  }
}

function handleFrame(data: string, h: StreamHandlers) {
  if (data === "[DONE]") return;
  let payload: any;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  switch (payload.type) {
    case "message_start":
      h.onStart?.({ model: payload.message?.model, id: payload.message?.id });
      if (payload.message?.usage) h.onUsage?.(payload.message.usage);
      break;
    case "content_block_delta":
      if (payload.delta?.type === "text_delta") h.onText?.(payload.delta.text ?? "");
      else if (payload.delta?.type === "thinking_delta") h.onThinking?.(payload.delta.thinking ?? "");
      break;
    case "message_delta":
      if (payload.usage) h.onUsage?.(payload.usage);
      if (payload.delta?.stop_reason !== undefined) h.onStop?.(payload.delta.stop_reason);
      break;
    case "error":
      throw new StreamError(errorMessage(payload) ?? "The provider returned an error.", 502);
  }
}
