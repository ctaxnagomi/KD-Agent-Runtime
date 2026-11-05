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
  <title>${projectName} | KD AI Services</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    .card { border: 1px solid #8884; border-radius: 12px; padding: 1rem 1.25rem; max-width: 720px; }
    .row { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    code { background: #0002; padding: .15rem .35rem; border-radius: 6px; }
    a { word-break: break-all; }
    .muted { opacity: .7; font-size: .9rem; }
  </style>
</head>
<body>
  <h1>${projectName}</h1>
  <p class="muted">KD AI Services visualisation + tunnel</p>
  <div class="card">
    <div class="row"><strong>Service port:</strong> <code>${PORT}</code></div>
    <div class="row"><strong>Tunnel status:</strong> <span id="tstatus">${tunnelStatus}</span></div>
    <div class="row"><strong>Tunnel URL:</strong> <a id="turl" href="#">${tunnelUrl || "pending..."}</a></div>
    <div class="row"><strong>Project path:</strong> <code>${__dirname}</code></div>
    <p class="muted">Auto-refreshes every 3s.</p>
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
  send(res, 200, dashboardHtml());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${projectName}] visualisation: http://localhost:${PORT}`);
});

function detectTunnelBin() {
  const pref = (process.env.TUNNEL || "").toLowerCase();
  if (pref === "none") return null;
  if (pref === "cloudflared" || pref === "localtunnel") return pref;
  // default: try cloudflared first
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
    // auto: prefer cloudflared if present
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
    // fallback to localtunnel if cloudflared missing
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
