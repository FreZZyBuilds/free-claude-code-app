#!/usr/bin/env node
/*
  FCC Studio production server.

  Serves the built app from ./dist and forwards API traffic to fcc-server on the
  same origin. FCC's Admin API only answers loopback callers with a local Host
  and Origin, so this server binds to 127.0.0.1 and rewrites those headers to
  point at the FCC target. Zero dependencies: Node's http module only.

  Env: FCC_URL (default http://127.0.0.1:8082), STUDIO_PORT (default 5174),
       STUDIO_HOST (default 127.0.0.1 — keep it on loopback).
*/
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist", import.meta.url)));
const target = new URL(process.env.FCC_URL ?? "http://127.0.0.1:8082");
const port = Number(process.env.STUDIO_PORT ?? 5174);
const host = process.env.STUDIO_HOST ?? "127.0.0.1";
const PROXIED = /^\/(admin|v1|v1beta|health)(\/|$|\?)/;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

if (!existsSync(join(root, "index.html"))) {
  console.error("dist/ is missing. Run `npm run build` first.");
  process.exit(1);
}

function proxy(req, res) {
  const client = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: target.host };
  if (headers.origin) headers.origin = target.origin;
  delete headers.referer;
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: `fcc-server is not reachable at ${target.origin}` }));
    } else res.destroy();
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", "http://x");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  let fallback = false;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, "index.html");
    fallback = true;
  }
  const ext = extname(file);
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...(fallback || ext === ".html" ? { "x-frame-options": "DENY" } : {}),
  });
  createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => (PROXIED.test(req.url ?? "") ? proxy(req, res) : serveStatic(req, res)))
  .listen(port, host, () => {
    console.log(`FCC Studio  →  http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
    console.log(`fcc-server  →  ${target.origin}`);
  });
