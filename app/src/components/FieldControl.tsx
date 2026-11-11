import { Lock, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ConfigField, ConfigValue } from "@/lib/types";
import { ModelCombobox } from "./ModelCombobox";
import { FieldShell, Input, Pill, Select, Switch, cx, inputClass } from "./ui";

export type Drafts = Record<string, ConfigValue>;

export function originalValue(field: ConfigField): string | null {
  return typeof field.value === "string" || field.value === null ? field.value : null;
}

/** Field-type aware editor for one Admin setting. `draft === undefined` means unchanged. */
export function FieldControl({
  field,
  draft,
  onDraft,
}: {
  field: ConfigField;
  draft: ConfigValue | undefined;
  onDraft: (v: ConfigValue | undefined) => void;
}) {
  const id = `f-${field.key}`;
  const original = originalValue(field);
  const current = draft === undefined ? original : (draft as string | null);
  const set = (v: string | null) => onDraft(v === original ? undefined : v);
  const disabled = field.locked;

  const badges = (
    <>
      {field.locked && (
        <Pill tone="idle">
          <Lock className="size-3" /> Set by environment
        </Pill>
      )}
      {field.restart_required && <Pill tone="warn">Restart</Pill>}
      {draft !== undefined && (
        <button
          type="button"
          onClick={() => onDraft(undefined)}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <RotateCcw className="size-3" /> Revert
        </button>
      )}
    </>
  );

  let control: React.ReactNode;
  switch (field.type) {
    case "boolean":
      control = (
        <div className="flex h-10 items-center">
          <Switch
            id={id}
            label={field.label}
            disabled={disabled}
            checked={current === "true"}
            onChange={(v) => set(v ? "true" : "false")}
          />
        </div>
      );
      break;
    case "select":
      control = (
        <Select id={id} disabled={disabled} value={current ?? ""} onChange={(e) => set(e.target.value || null)}>
          {field.nullable && <option value="">Default</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
      break;
    case "model":
    case "optional_model":
      control = (
        <ModelCombobox
          id={id}
          ariaLabel={field.label}
          disabled={disabled}
          optional={field.type === "optional_model"}
          value={current}
          onChange={(v) => set(v)}
        />
      );
      break;
    case "secret":
      control = <SecretInput field={field} draft={draft} onDraft={onDraft} id={id} />;
      break;
    case "textarea":
      control = (
        <textarea
          id={id}
          disabled={disabled}
          className={cx(inputClass, "h-24 py-2")}
          value={current ?? ""}
          onChange={(e) => set(e.target.value === "" && field.nullable ? null : e.target.value)}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          disabled={disabled}
          mono={/URL|PATH|DIR|HOST|ID$/.test(field.key)}
          value={current ?? ""}
          spellCheck={false}
          onChange={(e) => set(e.target.value === "" && field.nullable ? null : e.target.value)}
        />
      );
  }

  return (
    <FieldShell label={field.label} htmlFor={id} description={field.description} badges={badges}>
      {control}
    </FieldShell>
  );
}

function SecretInput({
  field,
  draft,
  onDraft,
  id,
}: {
  field: ConfigField;
  draft: ConfigValue | undefined;
  onDraft: (v: ConfigValue | undefined) => void;
  id: string;
}) {
  const [show, setShow] = useState(false);
  const cleared = draft === null;
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        mono
        type={show ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        disabled={field.locked || cleared}
        placeholder={cleared ? "Will be removed on apply" : field.configured ? "Saved — type to replace" : "Not set"}
        value={typeof draft === "string" ? draft : ""}
        onChange={(e) => onDraft(e.target.value ? e.target.value : undefined)}
        onFocus={() => setShow(false)}
      />
      {field.configured && field.nullable && !field.locked && (
        <button
          type="button"
          className="h-10 shrink-0 rounded-control px-3 text-[13px] text-muted hover:bg-raised hover:text-stop"
          onClick={() => onDraft(cleared ? undefined : null)}
        >
          {cleared ? "Keep" : "Clear"}
        </button>
      )}
    </div>
  );
}
