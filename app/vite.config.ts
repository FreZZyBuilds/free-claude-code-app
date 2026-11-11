import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// FCC's Admin API only answers loopback callers with a local Host/Origin,
// so the Studio always talks to it through a same-origin proxy.
const FCC_URL = process.env.FCC_URL ?? "http://127.0.0.1:8082";
const proxied = ["/admin", "/v1", "/v1beta", "/health"];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "providers/*.svg", "providers/*.png", "providers/*.ico"],
      manifest: {
        name: "FCC Studio",
        short_name: "FCC Studio",
        description: "Route Claude Code, Codex and 10 more coding agents to any model provider.",
        theme_color: "#3651F5",
        background_color: "#0E1524",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/admin/, /^\/v1/, /^\/health/],
        runtimeCaching: [],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: FCC_URL, changeOrigin: true }])),
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
