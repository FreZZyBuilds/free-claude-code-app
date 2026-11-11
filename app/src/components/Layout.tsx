import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  Cable,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  PlugZap,
  Search,
  Server,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import { useIsMobileServer, useStatus } from "@/hooks/data";
import { applyTheme, currentTheme, type Theme } from "@/lib/prefs";
import { CommandPalette } from "./CommandPalette";
import { ServerOffline } from "./ServerOffline";
import { cx, IconButton, Kbd, Spinner, StatusDot } from "./ui";

export const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/providers", label: "Providers", icon: Server },
  { to: "/routing", label: "Routing", icon: Cable },
  { to: "/playground", label: "Playground", icon: MessagesSquare },
  { to: "/integrations", label: "Integrations", icon: PlugZap },
  { to: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">FCC Studio</div>
        <div className="text-xs text-faint">Free Claude Code</div>
      </div>
    </div>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <IconButton
      label={`Theme: ${theme}. Switch to ${next[theme]}`}
      onClick={() => {
        const t = next[theme];
        setTheme(t);
        applyTheme(t);
      }}
    >
      <Icon className="size-4.5" />
    </IconButton>
  );
}

function ServerBadge() {
  const { data, error, isLoading } = useStatus();
  if (isLoading) return <Spinner />;
  const ok = !error && data?.status === "running";
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px]">
      <StatusDot tone={ok ? "ok" : "error"} live={ok} />
      <span className="truncate text-muted">
        {ok ? `${data!.edition === "mobile" ? "Android server" : "fcc-server"} · :${data!.port}` : "Server offline"}
      </span>
    </div>
  );
}

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { error, data, isLoading } = useStatus();
  const location = useLocation();
  const mobile = useIsMobileServer();
  const nav = mobile ? NAV.filter((n) => n.to !== "/integrations") : NAV;

  useEffect(() => setNavOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const offline = !isLoading && (!!error || !data);

  return (
    <div className="flex h-full">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface px-3 pt-4 pb-3 transition-transform lg:static lg:translate-x-0",
          navOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <IconButton label="Close navigation" className="lg:hidden" onClick={() => setNavOpen(false)}>
            <X className="size-5" />
          </IconButton>
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mt-5 flex h-9 items-center gap-2 rounded-control border border-line bg-raised px-2.5 text-[13px] text-faint transition-colors hover:border-line-strong"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <nav className="mt-4 flex flex-col gap-0.5" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest}
              className={({ isActive }) =>
                cx(
                  "flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg",
                )
              }
            >
              <Icon className="size-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-1 pt-3">
          <ServerBadge />
          <ThemeSwitch />
        </div>
      </aside>
      {navOpen && (
        <div className="fixed inset-0 z-30 bg-[#0b1020]/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-line bg-surface px-4 lg:hidden">
          <IconButton label="Open navigation" onClick={() => setNavOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
          <img src="/favicon.svg" alt="" className="size-6" />
          <span className="font-semibold">FCC Studio</span>
          <div className="ml-auto flex items-center">
            <IconButton label="Search" onClick={() => setPaletteOpen(true)}>
              <Search className="size-4.5" />
            </IconButton>
          </div>
        </header>
        <main className="scrollbar-thin flex-1 overflow-y-auto">
          {offline ? (
            <ServerOffline />
          ) : !data ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-9">
              <Suspense fallback={<Spinner />}>
                <Outlet />
              </Suspense>
            </div>
          )}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
