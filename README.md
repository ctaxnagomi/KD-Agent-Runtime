# KD Agent Runtime

![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0078D4)
![MCP](https://img.shields.io/badge/MCP-local%20stdio-6f42c1)
![OpenCode](https://img.shields.io/badge/OpenCode-project%20config-111827)
![License](https://img.shields.io/badge/license-MIT-green)

KD Agent Runtime is a project-local OpenCode configuration bundle plus a small service runner and MCP server.
It standardizes model routing (DeepSeek by default, premium GPT-6 models on demand), token/cost discipline,
JEV compliance checks, local visualisation dashboards, and tunnel bootstrapping for multiple projects.

## What is included

- `opencode.jsonc` — project-local provider, model, agent, and MCP configuration
- `routing-policy.md` — article-derived routing and cost-control policy
- `kd_aiservices.mjs` — local HTTP visualisation dashboard + tunnel bootstrap
- `start.kdservices-tunnel.bat` — launches all configured project services
- `kd-services-mcp/` — optional MCP server for managing services from OpenCode

## Quick start

1. Set your provider key:

   ```sh
   set KRAKEDDEVS_API_KEY=your-key-here
   ```

2. Open the project in OpenCode:

   ```sh
   cd "D:\KD Agent Runtime"
   opencode
   ```

3. Select models with `/models`. Default is `kd-gpt6/deepseek-v4.1-flash`.

4. Run one service:

   ```sh
   node kd_aiservices.mjs
   ```

   Then open the printed `http://localhost:<port>` dashboard.

5. Run all project services:

   ```bat
   start.kdservices-tunnel.bat
   ```

## Model routing

- Default: DeepSeek V4.1 Flash for recall/general work.
- Premium models (`gpt-6-sol`, `gpt-6-luna`, `gpt-6-astra`) and image models are used only when needed.
- Before non-default or combined model use, the agent asks the user with estimated tokens and USD cost.
- JEV (`rcc-jev`) is used for compliance and accuracy checks.

## Services and tunnels

Each `kd_aiservices.mjs` instance:

- starts a local HTTP dashboard on a deterministic port
- exposes `/health` and `/status`
- attempts a tunnel via `cloudflared`, then `localtunnel`
- shuts down cleanly on `SIGINT`/`SIGTERM`

## MCP server

`kd-services-mcp/server.mjs` is a dependency-free stdio MCP server with:

- `kd_list_projects`
- `kd_start_service`
- `kd_stop_service`
- `kd_service_status`
- `kd_start_all`
- `kd_stop_all`

## Compliance

- Local-first by default
- Writes require approval
- Compact returns and truncated tool results
- Round caps and budget guards
- JEV checks before non-default model use

## Topics

`opencode` `mcp` `ai-routing` `cost-optimization` `jev` `local-first` `tunnel` `dashboard`

---

This is an unofficial KD product. These are only for KD Workshop-session to ensure he output usage from KD Service provider are within KD Compliance and model-routing autonomous assistance.
