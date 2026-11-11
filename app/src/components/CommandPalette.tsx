import { Command } from "cmdk";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ExternalLink, RefreshCw, Server } from "lucide-react";
import { useConfig, useIsMobileServer, useRefreshModels } from "@/hooks/data";
import { NAV } from "./Layout";
import { ProviderLogo } from "./ProviderLogo";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const refresh = useRefreshModels();
  const mobile = useIsMobileServer();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const item =
    "flex h-10 cursor-pointer items-center gap-3 rounded-control px-3 text-sm data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent";

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClick={(e) => e.target === ref.current && onOpenChange(false)}
      className="mx-auto mt-[12vh] w-[calc(100%-32px)] max-w-xl rounded-panel border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-[#0b1020]/45"
    >
      {open && (
        <Command label="Command palette" loop>
          <Command.Input
            autoFocus
            placeholder="Search pages, providers and actions…"
            className="h-13 w-full border-b border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-faint"
          />
          <Command.List className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">No results.</Command.Empty>
            <Command.Group heading="Pages" className="text-xs text-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
              {NAV.filter((n) => !mobile || n.to !== "/integrations").map(({ to, label, icon: Icon }) => (
                <Command.Item key={to} value={`page ${label}`} onSelect={() => go(to)} className={item}>
                  <Icon className="size-4" />
                  <span className="text-fg">{label}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className="text-xs text-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
              <Command.Item
                value="refresh models discover"
                onSelect={() => {
                  onOpenChange(false);
                  refresh.mutate();
                }}
                className={item}
              >
                <RefreshCw className="size-4" />
                <span className="text-fg">Refresh model catalog</span>
              </Command.Item>
              <Command.Item
                value="add custom provider"
                onSelect={() => go("/providers?custom=new")}
                className={item}
              >
                <Server className="size-4" />
                <span className="text-fg">Add custom provider</span>
              </Command.Item>
              {!mobile && <Command.Item
                value="open classic admin code sessions"
                onSelect={() => {
                  onOpenChange(false);
                  window.open("/admin/code", "_blank", "noopener");
                }}
                className={item}
              >
                <ExternalLink className="size-4" />
                <span className="text-fg">Open native Code sessions</span>
              </Command.Item>}
            </Command.Group>
            {config && (
              <Command.Group heading="Providers" className="text-xs text-faint [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
                {config.provider_status.map((p) => (
                  <Command.Item
                    key={p.provider_id}
                    value={`provider ${p.display_name} ${p.provider_id}`}
                    onSelect={() => go(`/providers?open=${p.provider_id}`)}
                    className={item}
                  >
                    <ProviderLogo provider={p} size="sm" />
                    <span className="flex-1 text-fg">{p.display_name}</span>
                    <span className="text-xs text-faint">{p.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      )}
    </dialog>
  );
}
