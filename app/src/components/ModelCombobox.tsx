import { ChevronsUpDown } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useModels } from "@/hooks/data";
import { providerOf } from "@/lib/catalog";
import { cx, inputClass } from "./ui";

const LIMIT = 80;

/** "Local Mock/mock-coder" → "Local Mock"; falls back to the provider id. */
export function providerLabel(ref: string, labels: Record<string, string>) {
  const label = labels[ref];
  const name = ref.slice((providerOf(ref)?.length ?? -1) + 1);
  if (label && label !== ref && label.endsWith("/" + name)) return label.slice(0, -name.length - 1);
  return providerOf(ref) ?? "";
}

/**
 * Searchable model picker. Accepts any custom `provider/model` slug.
 * `value === null` means "inherit" for optional fields.
 */
export function ModelCombobox({
  value,
  onChange,
  optional,
  placeholder,
  id,
  disabled,
  ariaLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  optional?: boolean;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const { data } = useModels();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = data?.model_labels ?? {};
  const text = query ?? (value ? labels[value] ?? value : "");
  const options = useMemo(() => {
    const all = data?.models ?? [];
    const q = (query ?? "").trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const hay = (m: string) => `${m} ${data?.model_labels[m] ?? ""}`.toLowerCase();
    const hits = terms.length ? all.filter((m) => terms.every((t) => hay(m).includes(t))) : all;
    return hits.slice(0, LIMIT);
  }, [data, query]);

  const items: (string | null)[] = optional ? [null, ...options] : options;

  const commit = (v: string | null) => {
    onChange(v);
    setQuery(null);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items.length ? `${listId}-${active}` : undefined}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={optional ? placeholder ?? "Inherit default model" : placeholder ?? "provider/model"}
        className={cx(inputClass, "pr-9 font-mono text-[13px]")}
        value={text}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
          if (query !== null) {
            const t = query.trim();
            if (t !== (value ?? "")) onChange(t ? t : optional ? null : value);
            setQuery(null);
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && items.length && query !== null && items[active] !== undefined) commit(items[active]);
            else if (query !== null) commit(query.trim() || (optional ? null : value));
            inputRef.current?.blur();
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            setQuery(null);
          }
        }}
      />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="scrollbar-thin absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-control border border-line bg-surface p-1 shadow-xl"
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-muted">
              No match. Press Enter to use <span className="font-mono">{text}</span> as a custom slug.
            </li>
          )}
          {items.map((m, i) => (
            <li
              key={m ?? "__inherit"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={m === value}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                i === active && "bg-accent-soft",
              )}
            >
              {m === null ? (
                <span className="text-muted italic">Inherit default model</span>
              ) : (
                <>
                  <span className="max-w-[40%] shrink-0 truncate rounded bg-raised px-1.5 py-px text-[11px] text-muted">
                    {providerLabel(m, labels)}
                  </span>
                  <span className="truncate font-mono">{m.slice((providerOf(m)?.length ?? -1) + 1)}</span>
                </>
              )}
            </li>
          ))}
          {(data?.models.length ?? 0) > LIMIT && options.length === LIMIT && (
            <li className="px-3 py-1.5 text-xs text-faint">Type to narrow {data!.models.length} models…</li>
          )}
        </ul>
      )}
    </div>
  );
}
