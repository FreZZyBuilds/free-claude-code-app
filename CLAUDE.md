# FCC Studio

A modern web app (installable PWA) that controls a local
[Free Claude Code](https://github.com/Alishahryar1/free-claude-code) (FCC) proxy server.

## Layout
- `app/` — React 19 + TypeScript + Vite 8 + Tailwind v4 + TanStack Query. All Studio code lives here.
  - `src/lib/api.ts`, `src/lib/types.ts` — typed client for FCC's Admin API (`/admin/api/*`). Types were
    captured from a running fcc-server; keep them in sync when the server changes.
  - `src/lib/stream.ts` — Anthropic Messages SSE client for `/v1/messages` (Playground).
  - `src/pages/*` — Overview, Providers, Routing, Playground, Integrations, Settings.
  - `server.mjs` — zero-dependency production server: serves `dist/` and proxies `/admin`, `/v1`, `/health`.
- `android/` — Android app (Gradle, AGP 8.13, Kotlin 2.4, compileSdk 36).
  - `core/` — pure-Kotlin embedded server (Ktor CIO): Anthropic Messages ↔ OpenAI Chat translation
    (`Translate.kt`), routing/key rotation/fallbacks (`Engine.kt`), Studio-compatible Admin API subset
    (`AdminApi.kt`, reports `edition: "mobile"`), HTTP server (`FccServer.kt`). Runs on the JVM for tests:
    `./gradlew :core:test` and `./gradlew :core:run --args="../../app/dist"`.
  - `ProviderCatalog.kt` is generated from the upstream provider catalog; regenerate rather than hand-edit.
  - `app/` — Compose Play screen, foreground service (`specialUse`), WebView for Studio. The built web UI
    (`app/dist`) is copied into the APK by the `syncStudio` task, so build the web app first.
- `server/` — git submodule of the upstream FCC server (Python 3.14, FastAPI, `uv`). Do not edit; update with
  `git submodule update --remote server`.
- `scripts/start.sh` / `start.ps1` — one-command start (FCC + Studio).
- `.claude/skills/` — curated skills from aitmpl.com; see its README.

## Rules that matter
- FCC's Admin API only accepts loopback clients whose `Host` and `Origin` are local. The Studio must always
  reach it through a same-origin proxy (Vite dev proxy or `server.mjs`), bound to 127.0.0.1. Never bind
  `server.mjs` to a public interface.
- Secrets never come back from the server. API key lists are edited as ordered rows that either `retain`
  a saved reference or carry a new `value` (see `ApiKeyListEditor.tsx`).
- Applying config may trigger an automatic server restart (`restart.automatic`); `useApply` waits for a new
  `instance_id` before refreshing.
- Model output is rendered by `src/lib/markdown.tsx`, which builds React nodes only. Do not switch to innerHTML.

- Studio must keep working against both servers. Desktop-only features are hidden when
  `status.edition === "mobile"` (`useIsMobileServer`).

## Commands (in `app/`)
- `npm run dev` — Vite on :5173 (proxies to `FCC_URL`, default http://127.0.0.1:8082)
- `npm run typecheck` · `npm test` (Vitest) · `npm run build`
- `npm run test:e2e` — Playwright against a running fcc-server
