// kd_aiservices.mjs
// Universal local service + visualisation + tunnel bootstrap
// Usage: node kd_aiservices.mjs
// Env: PORT=xxxx, PROJECT_NAME=..., TUNNEL=cloudflared|localtunnel|none

import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectName =
  process.env.PROJECT_NAME ||
  path.basename(__dirname) ||
  "kd-project";

function hashPort(seed) {
  const h = crypto.createHash("sha256").update(seed).digest();
  return 4100 + (h.readUInt32BE(0) % 900);
}

const PORT = Number(process.env.PORT) || hashPort(__dirname);
let tunnelUrl = null;
let tunnelStatus = "starting";
let tunnelProc = null;

function send(res, code, body, type = "text/html; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${projectName} | KD Agent Runtime</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #0b0b0f;
      --muted: #6b7280;
      --accent: #111827;
      --shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
      --shadow-soft: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: "Inter", system-ui, sans-serif;
      overflow-x: hidden;
    }
    .scene {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 6rem 1.5rem;
      position: relative;
    }
    .glow {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(60% 40% at 20% 10%, rgba(99,102,241,0.08), transparent 60%),
        radial-gradient(50% 40% at 80% 90%, rgba(14,165,233,0.08), transparent 60%);
      filter: blur(40px);
      z-index: 0;
    }
    .content {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 980px;
    }
    .eyebrow {
      font-size: 0.9rem;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 1.5rem;
      opacity: 0;
      transform: translateY(12px);
      filter: blur(8px);
    }
    .title {
      font-family: "Space Grotesk", sans-serif;
      font-weight: 700;
      font-size: clamp(2.6rem, 8vw, 6.5rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
      margin: 0 0 1.25rem;
      opacity: 0;
      transform: translateY(24px);
      filter: blur(12px);
      text-shadow: 0 20px 60px rgba(15,23,42,0.18);
    }
    .title .accent {
      background: linear-gradient(120deg, #111827, #4f46e5, #0ea5e9);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      font-size: clamp(1rem, 2vw, 1.35rem);
      color: var(--muted);
      max-width: 640px;
      margin: 0 auto 2.5rem;
      opacity: 0;
      transform: translateY(16px);
      filter: blur(8px);
    }
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      opacity: 0;
      transform: translateY(12px);
      filter: blur(6px);
    }
    .btn {
      padding: 0.9rem 1.6rem;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: var(--fg);
      text-decoration: none;
      font-weight: 600;
      box-shadow: var(--shadow-soft);
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    .btn.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .floating {
      position: absolute;
      font-family: "Space Grotesk", sans-serif;
      font-weight: 700;
      color: rgba(15,23,42,0.06);
      pointer-events: none;
      user-select: none;
      filter: blur(2px);
      white-space: nowrap;
    }
    .f1 { top: 8%; left: 6%; font-size: clamp(2rem, 6vw, 5rem); }
    .f2 { bottom: 10%; right: 5%; font-size: clamp(2rem, 6vw, 5rem); }
    .f3 { top: 18%; right: 8%; font-size: clamp(1.5rem, 4vw, 3.5rem); }
    .meta {
      margin-top: 3rem;
      font-size: 0.85rem;
      color: var(--muted);
      opacity: 0;
      transform: translateY(8px);
      filter: blur(4px);
    }
    .meta code {
      background: #f3f4f6;
      padding: .2rem .45rem;
      border-radius: 6px;
      color: #111827;
    }
    @media (prefers-reduced-motion: reduce) {
      .eyebrow, .title, .subtitle, .actions, .meta { opacity: 1; transform: none; filter: none; }
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="floating f1">KD</div>
  <div class="floating f2">RUNTIME</div>
  <div class="floating f3">AGENT</div>

  <main class="scene">
    <section class="content">
      <div class="eyebrow">KD Agent Runtime</div>
      <h1 class="title">Build <span class="accent">local-first</span><br/>AI that floats.</h1>
      <p class="subtitle">
        A clean, white, motion-first landing surface for your services, tunnels, and model routing.
        Smooth GSAP transitions, soft shadow depth, and zero visual clutter.
      </p>
      <div class="actions">
        <a class="btn primary" href="/dashboard">Open Dashboard</a>
        <a class="btn" href="/status">Service Status</a>
      </div>
      <div class="meta">
        Project: <code>${projectName}</code> &nbsp;|&nbsp; Port: <code>${PORT}</code> &nbsp;|&nbsp; Tunnel: <code>${tunnelStatus}</code>
      </div>
    </section>
  </main>

  <script>
    window.addEventListener("load", () => {
      if (typeof gsap === "undefined") return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(".eyebrow", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8 })
        .to(".title", { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.0 }, "-=0.45")
        .to(".subtitle", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8 }, "-=0.55")
        .to(".actions", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7 }, "-=0.5")
        .to(".meta", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6 }, "-=0.45");

      gsap.to(".f1", { y: -18, x: 6, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".f2", { y: 14, x: -8, duration: 7, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".f3", { y: -10, x: 10, duration: 5.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
  </script>
  <!-- by ctaxnagomi -->
</body>
</html>`;
}

function dashboardPanelHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${projectName} | Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #fff; color: #111; }
    .card { border: 1px solid #8884; border-radius: 12px; padding: 1rem 1.25rem; max-width: 720px; box-shadow: 0 18px 50px rgba(15,23,42,.08); }
    .row { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; margin: .35rem 0; }
    code { background: #f3f4f6; padding: .15rem .35rem; border-radius: 6px; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <h1>${projectName}</h1>
  <p style="opacity:.7">KD AI Services dashboard</p>
  <div class="card">
    <div class="row"><strong>Service port:</strong> <code>${PORT}</code></div>
    <div class="row"><strong>Tunnel status:</strong> <span id="tstatus">${tunnelStatus}</span></div>
    <div class="row"><strong>Tunnel URL:</strong> <a id="turl" href="#">${tunnelUrl || "pending..."}</a></div>
    <div class="row"><strong>Project path:</strong> <code>${__dirname}</code></div>
    <p style="opacity:.7;font-size:.9rem">Auto-refreshes every 3s. <a href="/">Back to landing</a></p>
  </div>
  <script>
    async function tick() {
      try {
        const r = await fetch('/status');
        const j = await r.json();
        document.getElementById('tstatus').textContent = j.tunnelStatus;
        const a = document.getElementById('turl');
        a.textContent = j.tunnelUrl || 'pending...';
        a.href = j.tunnelUrl || '#';
      } catch (e) {}
    }
    setInterval(tick, 3000);
    tick();
  </script>
  <!-- by ctaxnagomi -->
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url === "/status") {
    send(res, 200, JSON.stringify({ projectName, port: PORT, tunnelStatus, tunnelUrl }), "application/json; charset=utf-8");
    return;
  }
  if (req.url === "/health") {
    send(res, 200, "ok", "text/plain; charset=utf-8");
    return;
  }
  if (req.url === "/dashboard") {
    send(res, 200, dashboardPanelHtml());
    return;
  }
  send(res, 200, dashboardHtml());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${projectName}] visualisation: http://localhost:${PORT}`);
});

function detectTunnelBin() {
  const pref = (process.env.TUNNEL || "").toLowerCase();
  if (pref === "none") return null;
  if (pref === "cloudflared" || pref === "localtunnel") return pref;
  return "auto";
}

function spawnTunnel() {
  const mode = detectTunnelBin();
  if (mode === "none") {
    tunnelStatus = "disabled";
    return;
  }

  let cmd, args;
  if (mode === "localtunnel") {
    cmd = process.platform === "win32" ? "npx.cmd" : "npx";
    args = ["--yes", "localtunnel", "--port", String(PORT)];
  } else if (mode === "cloudflared") {
    cmd = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
    args = ["tunnel", "--url", `http://localhost:${PORT}`];
  } else {
    cmd = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
    args = ["tunnel", "--url", `http://localhost:${PORT}`];
  }

  try {
    tunnelProc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: true });
  } catch (e) {
    tunnelStatus = "spawn-failed";
    console.warn(`[${projectName}] tunnel spawn failed:`, e.message);
    return;
  }

  const handleData = (buf) => {
    const text = buf.toString();
    process.stdout.write(text);
    const m1 = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    const m2 = text.match(/your url is:\s*(https:\/\/[^\s]+)/i);
    const m3 = text.match(/(https:\/\/[a-z0-9-]+\.loca\.lt)/i);
    const url = m1?.[0] || m2?.[1] || m3?.[0];
    if (url && !tunnelUrl) {
      tunnelUrl = url;
      tunnelStatus = "ready";
      console.log(`[${projectName}] tunnel ready: ${tunnelUrl}`);
    }
  };

  tunnelProc.stdout.on("data", handleData);
  tunnelProc.stderr.on("data", handleData);
  tunnelProc.on("error", (err) => {
    if (!tunnelUrl && cmd.includes("cloudflared")) {
      console.warn(`[${projectName}] cloudflared unavailable, trying localtunnel...`);
      const c2 = process.platform === "win32" ? "npx.cmd" : "npx";
      tunnelProc = spawn(c2, ["--yes", "localtunnel", "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"], shell: true });
      tunnelProc.stdout.on("data", handleData);
      tunnelProc.stderr.on("data", handleData);
      tunnelProc.on("error", (e2) => {
        tunnelStatus = "error";
        console.warn(`[${projectName}] tunnel error:`, e2.message);
      });
    } else {
      tunnelStatus = "error";
      console.warn(`[${projectName}] tunnel error:`, err.message);
    }
  });
  tunnelProc.on("exit", (code) => {
    if (tunnelStatus !== "ready") tunnelStatus = `exited(${code})`;
  });
  tunnelStatus = "connecting";
}

spawnTunnel();

function shutdown() {
  console.log(`[${projectName}] shutting down...`);
  try { if (tunnelProc) tunnelProc.kill(); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[${projectName}] kd_aiservices ready on port ${PORT}`);
// by ctaxnagomi
