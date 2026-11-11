import { clsx } from "clsx";
import { Check, Copy, Loader2, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { toast } from "sonner";

export { clsx as cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; size?: "sm" | "md"; icon?: ReactNode }
>(function Button({ variant = "secondary", busy, size = "md", icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-cobalt-500 text-white hover:bg-cobalt-600 active:bg-cobalt-700",
        variant === "secondary" && "border border-line-strong bg-surface text-fg hover:bg-raised",
        variant === "ghost" && "text-muted hover:bg-raised hover:text-fg",
        variant === "danger" && "border border-stop/40 bg-surface text-stop hover:bg-stop/10",
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-fg disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type Tone = "ok" | "warn" | "error" | "idle" | "info";

const toneClass: Record<Tone, string> = {
  ok: "text-go",
  warn: "text-amber-signal",
  error: "text-stop",
  idle: "text-faint",
  info: "text-accent",
};

export function StatusDot({ tone, live, className }: { tone: Tone; live?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block size-2 shrink-0 rounded-full bg-current", toneClass[tone], className)}
      style={live ? { animation: "pulse-ring 1.8s ease-out infinite" } : undefined}
    />
  );
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "ok" && "border-go/30 bg-go/10 text-go",
        tone === "warn" && "border-amber-signal/35 bg-amber-signal/10 text-[#a8681a] dark:text-amber-signal",
        tone === "error" && "border-stop/30 bg-stop/10 text-stop",
        tone === "idle" && "border-line bg-raised text-muted",
        tone === "info" && "border-cobalt-500/25 bg-accent-soft text-accent",
        className,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={clsx("rounded-panel border border-line bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export const inputClass =
  "h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-fg placeholder:text-faint " +
  "transition-colors focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  function Input({ className, mono, ...rest }, ref) {
    return <input ref={ref} className={clsx(inputClass, mono && "font-mono text-[13px]", className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputClass, "appearance-auto pr-2", className)} {...rest}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-cobalt-500" : "bg-line-strong",
      )}
    >
      <span
        className={clsx(
          "inline-block size-4.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[19px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("size-4 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label={done ? "Copied" : label}
      className={clsx("size-8", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          toast.error("Clipboard is not available in this browser.");
        }
      }}
    >
      {done ? <Check className="size-4 text-go" /> : <Copy className="size-4" />}
    </IconButton>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-raised px-1.5 py-px font-mono text-[11px] text-muted">
      {children}
    </kbd>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Side sheet built on <dialog> so focus trapping and Escape come for free. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx(
        "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-full border-l border-line bg-surface p-0 text-fg",
        "backdrop:bg-[#0b1020]/45 backdrop:backdrop-blur-[2px]",
        wide ? "sm:w-[620px]" : "sm:w-[520px]",
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-4">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-[-0.01em]">{title}</h2>
              {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
            </div>
            <IconButton label="Close" onClick={onClose} autoFocus>
              <X className="size-5" />
            </IconButton>
          </header>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex items-center gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function FieldShell({
  label,
  htmlFor,
  description,
  badges,
  children,
  error,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {badges}
      </div>
      {children}
      {error ? (
        <p className="text-[13px] text-stop">{error}</p>
      ) : (
        description && <p className="text-[13px] leading-snug text-muted">{description}</p>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
