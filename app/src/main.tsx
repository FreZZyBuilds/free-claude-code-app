import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { Layout } from "@/components/Layout";
import { OverviewPage } from "@/pages/Overview";
const ProvidersPage = lazy(() => import("@/pages/Providers").then((m) => ({ default: m.ProvidersPage })));
const RoutingPage = lazy(() => import("@/pages/Routing").then((m) => ({ default: m.RoutingPage })));
const PlaygroundPage = lazy(() => import("@/pages/Playground").then((m) => ({ default: m.PlaygroundPage })));
const IntegrationsPage = lazy(() => import("@/pages/Integrations").then((m) => ({ default: m.IntegrationsPage })));
const SettingsPage = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })));
import { NotFound } from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "providers", element: <ProvidersPage /> },
      { path: "routing", element: <RoutingPage /> },
      { path: "playground", element: <PlaygroundPage /> },
      { path: "integrations", element: <IntegrationsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/:section", element: <SettingsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          className: "!font-sans !rounded-[12px] !border-line !bg-surface !text-fg",
          descriptionClassName: "!text-muted whitespace-pre-line",
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
