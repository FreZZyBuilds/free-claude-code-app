import { ArrowDown, ArrowUp, Eye, EyeOff, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ApiKeyListMutation, ApiKeyListValue } from "@/lib/types";
import { Button, IconButton, Input } from "./ui";

export interface KeyRow {
  uid: number;
  reference?: number;
  value: string;
}

let uid = 0;
export const rowsFromValue = (v: ApiKeyListValue | null | undefined): KeyRow[] =>
  (v?.entries ?? []).map((e) => ({ uid: ++uid, reference: e.reference, value: "" }));

export function keyRowsPayload(revision: string | null, rows: KeyRow[]): ApiKeyListMutation {
  return {
    revision,
    entries: rows.map((r) =>
      r.value.trim() || r.reference === undefined ? { value: r.value.trim() } : { retain: r.reference },
    ),
  };
}

/** Returns an error per row index, or null when the list is valid. */
export function validateKeyRows(rows: KeyRow[]): Record<number, string> | null {
  const errors: Record<number, string> = {};
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const v = r.value.trim();
    if (!v && r.reference === undefined) errors[i] = "Enter a key or remove this row.";
    else if (v && seen.has(v)) errors[i] = `Duplicates key ${seen.get(v)! + 1}.`;
    else if (v) seen.set(v, i);
  });
  return Object.keys(errors).length ? errors : null;
}

/**
 * Ordered credential list. Saved keys are never sent to the browser; rows keep a
 * reference to them so reordering or removal works without re-entering secrets.
 * Order matters: FCC falls back to the next key when one is rate limited.
 */
export function ApiKeyListEditor({
  rows,
  onChange,
  errors,
  disabled,
  label,
}: {
  rows: KeyRow[];
  onChange: (rows: KeyRow[]) => void;
  errors?: Record<number, string> | null;
  disabled?: boolean;
  label: string;
}) {
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const move = (i: number, d: number) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r);
    onChange(next);
  };
  return (
    <div className="space-y-2" role="group" aria-label={label}>
      {rows.length === 0 && <p className="text-[13px] text-muted">No keys yet.</p>}
      {rows.map((r, i) => (
        <div key={r.uid}>
          <div className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-center font-mono text-xs text-faint">{i + 1}</span>
            <div className="relative flex-1">
              <Input
                mono
                aria-label={`${label} ${i + 1}`}
                aria-invalid={!!errors?.[i] || undefined}
                type={reveal[r.uid] ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                placeholder={r.reference !== undefined ? "Saved key — type to replace" : "Paste API key"}
                value={r.value}
                onChange={(e) => onChange(rows.map((x) => (x.uid === r.uid ? { ...x, value: e.target.value } : x)))}
                className={errors?.[i] ? "border-stop pr-9" : "pr-9"}
              />
              {r.reference !== undefined && !r.value && (
                <KeyRound className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-go" />
              )}
              {r.value && (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-faint hover:text-fg"
                  aria-label={reveal[r.uid] ? "Hide key" : "Show key"}
                  onClick={() => setReveal((s) => ({ ...s, [r.uid]: !s[r.uid] }))}
                >
                  {reveal[r.uid] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
            </div>
            <IconButton label="Move up" disabled={disabled || i === 0} onClick={() => move(i, -1)} className="size-8">
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton
              label="Move down"
              disabled={disabled || i === rows.length - 1}
              onClick={() => move(i, 1)}
              className="size-8"
            >
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton
              label={`Remove key ${i + 1}`}
              disabled={disabled}
              onClick={() => onChange(rows.filter((x) => x.uid !== r.uid))}
              className="size-8 hover:text-stop"
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
          {errors?.[i] && <p className="mt-1 ml-6.5 text-[13px] text-stop">{errors[i]}</p>}
        </div>
      ))}
      <Button
        size="sm"
        disabled={disabled}
        icon={<Plus className="size-4" />}
        onClick={() => onChange([...rows, { uid: ++uid, value: "" }])}
      >
        Add key
      </Button>
    </div>
  );
}
