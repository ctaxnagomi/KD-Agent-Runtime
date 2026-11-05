// kd-services-mcp/server.mjs
// Minimal MCP server (stdio) managing KD AI services + tunnels.
// No external dependencies.

import readline from "node:readline";
import { spawn } from "node:child_process";
import path from "node:path";

const PROJECTS = [
  "C:\\Users\\KR\\Desktop\\social-media-automate",
  "C:\\Users\\KR\\Desktop\\KDWPC ONLINE SESSION",
  "C:\\Users\\KR\\Desktop\\kdbug",
  "C:\\Users\\KR\\Desktop\\KD-JEV-MCP",
  "C:\\Users\\KR\\Desktop\\KDType_BeginnerIDE",
  "C:\\Users\\KR\\Desktop\\my-roomIn3D-ctaxnagomi",
  "C:\\Users\\KR\\Desktop\\govinme",
  "C:\\Users\\KR\\Desktop\\modeling-sketch-work",
  "D:\\KD Agent Runtime",
];

const services = new Map(); // project -> { proc, pid, port, tunnelUrl, status, logs }

function shortName(p) {
  return path.basename(p);
}

function write(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendResult(id, result) {
  write({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  write({ jsonrpc: "2.0", id, error: { code, message } });
}

function parsePort(text) {
  const m = text.match(/visualisation:\s*http:\/\/localhost:(\d+)/i);
  if (m) return Number(m[1]);
  const m2 = text.match(/ready on port (\d+)/i);
  if (m2) return Number(m2[1]);
  return null;
}

function parseTunnel(text) {
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (m) return m[0];
  const m2 = text.match(/your url is:\s*(https:\/\/[^\s]+)/i);
  if (m2) return m2[1];
  const m3 = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
  if (m3) return m3[0];
  return null;
}

function startService(project) {
  const existing = services.get(project);
  if (existing && existing.proc && !existing.proc.killed) {
    return { project, status: "already-running", pid: existing.pid, port: existing.port, tunnelUrl: existing.tunnelUrl };
  }
  const proc = spawn("node", ["kd_aiservices.mjs"], {
    cwd: project,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  const rec = { proc, pid: proc.pid, port: null, tunnelUrl: null, status: "starting", logs: "" };
  services.set(project, rec);

  const onData = (buf) => {
    const text = buf.toString();
    rec.logs += text;
    const p = parsePort(text);
    if (p && !rec.port) rec.port = p;
    const t = parseTunnel(text);
    if (t && !rec.tunnelUrl) rec.tunnelUrl = t;
    if (text.includes("kd_aiservices ready")) rec.status = "ready";
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);
  proc.on("exit", (code) => {
    rec.status = `exited(${code})`;
    rec.proc = null;
  });

  return { project, status: "started", pid: rec.pid };
}

function stopService(project) {
  const rec = services.get(project);
  if (!rec || !rec.proc) return { project, status: "not-running" };
  try { rec.proc.kill(); } catch {}
  rec.status = "stopped";
  rec.proc = null;
  return { project, status: "stopped" };
}

function serviceStatus(project) {
  const rec = services.get(project);
  if (!rec) return { project, status: "never-started", port: null, tunnelUrl: null };
  return {
    project,
    status: rec.status,
    pid: rec.pid,
    port: rec.port,
    tunnelUrl: rec.tunnelUrl,
    dashboard: rec.port ? `http://localhost:${rec.port}` : null,
  };
}

const TOOLS = [
  {
    name: "kd_list_projects",
    description: "List KD project paths managed by this MCP server.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "kd_start_service",
    description: "Start kd_aiservices.mjs for a project path.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string", description: "Full project path" } },
      required: ["project"],
    },
  },
  {
    name: "kd_stop_service",
    description: "Stop a running KD service for a project path.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" } },
      required: ["project"],
    },
  },
  {
    name: "kd_service_status",
    description: "Get status, port, and tunnel URL for a project.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" } },
      required: ["project"],
    },
  },
  {
    name: "kd_start_all",
    description: "Start services for all known projects.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "kd_stop_all",
    description: "Stop all running KD services.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

function callTool(name, args) {
  switch (name) {
    case "kd_list_projects":
      return { content: [{ type: "text", text: JSON.stringify(PROJECTS, null, 2) }] };
    case "kd_start_service": {
      const r = startService(args.project);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    }
    case "kd_stop_service": {
      const r = stopService(args.project);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    }
    case "kd_service_status": {
      // allow a short delay for port parsing
      const r = serviceStatus(args.project);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    }
    case "kd_start_all": {
      const out = PROJECTS.map((p) => startService(p));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
    case "kd_stop_all": {
      const out = PROJECTS.map((p) => stopService(p));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  const { id, method, params } = msg;

  if (method === "initialize") {
    sendResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "kd-services-mcp", version: "1.0.0" },
    });
    return;
  }

  if (method === "notifications/initialized") {
    return; // no response
  }

  if (method === "tools/list") {
    sendResult(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    try {
      const result = callTool(params.name, params.arguments || {});
      sendResult(id, result);
    } catch (e) {
      sendError(id, -32000, String(e && e.message ? e.message : e));
    }
    return;
  }

  if (id !== undefined) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

// by ctaxnagomi
