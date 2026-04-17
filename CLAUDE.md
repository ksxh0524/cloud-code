# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloud Code is a mobile-optimized web interface for Claude Code. Users interact with the Claude Agent SDK through a browser-based chat UI, with WebSocket streaming for real-time responses.

## Tech Stack

- **Backend**: Node.js + Express + `@anthropic-ai/claude-agent-sdk`
- **Frontend**: React 19 + Vite + TypeScript + `@headlessui/react`
- **Data**: JSON file at `~/.cloud-code/data.json`
- **Testing**: Playwright E2E

## Common Commands

```bash
# Install all dependencies (root installs both workspaces)
pnpm install

# Development (two terminals)
cd backend && pnpm dev          # Backend on port 18765 (tsx watch)
pnpm dev                        # Frontend on port 18766 (Vite)

# Development (both at once)
pnpm dev:all

# Build
pnpm build                      # Frontend + Backend production build
cd backend && pnpm build        # Backend TypeScript compile only

# Test
npx playwright test                          # All E2E tests
npx playwright test test/mobile-ui.spec.ts   # Single file
npx playwright test --headed                 # Visible browser

# Lint & format
pnpm lint && pnpm lint:fix
pnpm format
```

## Architecture

### Backend (`backend/src/`)

- `server.ts` — Express + WebSocket server on port 18765. REST routes at `/api/*`, WebSocket at `/ws`. Pino HTTP request logging. Graceful shutdown with signal handling.
- `agent-service.ts` — Claude Agent SDK integration. Singleton `AgentService` manages sessions in a `Map`. Calls `query()` with `persistSession: true`, streams `SDKMessage`s via `for await...of`, converts each to `WebSocketMessage`. Default tools: `Read`, `Edit`, `Bash`, `Glob`, `Grep`. Default max turns: 50.
- `routes.ts` — REST API: conversations CRUD, CLI type checking, work directory listing, app config. Zod schemas validate all mutating endpoints. Uses `execFile` (not `execSync`) for CLI version checks.
- `store.ts` — JSON file persistence at `~/.cloud-code/data.json`. Async mutex serializes concurrent writes. All write operations are async and use `withLock()`.
- `types.ts` — `WebSocketMessage` and `AgentConfig` interfaces. (Session/Message types live in frontend only.)
- `logger.ts` — Shared pino logger with `pino-pretty` transport. Configured via `LOG_LEVEL` env var (default `info`).

### Frontend (`frontend/src/`)

- `App.tsx` — Routes: `/` → ChatNew, `/settings` → Settings
- `pages/ChatNew.tsx` — Main chat page. Manages conversations, messages, WebSocket via `useAgentWebSocket`.
- `pages/Settings.tsx` — Feishu config + default work directory settings.
- `components/MessageList.tsx` / `MessageItem.tsx` / `ToolCall.tsx` / `CodeBlock.tsx` — Message rendering.
- `components/InputBox.tsx` — Auto-resizing textarea with send/interrupt.
- `hooks/useAgentWebSocket.ts` — WebSocket hook, connects on mount, auto-reconnects.

### Data Flow

1. User creates conversation → `POST /api/conversations` → saved to JSON file
2. Frontend opens WebSocket to backend
3. User sends prompt → WebSocket `prompt` message → `agentService.streamMessage()`
4. SDK streams messages → WebSocket back to frontend → rendered as MessageItems
5. Tool calls, thinking, and results all streamed as separate message types

### WebSocket Protocol

Client → Server:
```json
{"type": "init", "data": {"workDir": "/path", "env": {...}}}
{"type": "prompt", "data": {"prompt": "text", "workDir": "/path"}}
{"type": "interrupt"}
```

Server → Client:
```json
{"type": "connected", "data": {"sessionId": "uuid"}}
{"type": "message", "data": {"role": "assistant", "content": "...", "type": "text"}}
{"type": "stream", "data": {"delta": {"text": "chunk"}}}
{"type": "tool_call", "data": {"toolName": "Bash", "toolInput": {...}}}
{"type": "tool_result", "data": {"toolName": "Bash", "toolOutput": "..."}}
{"type": "thinking", "data": {"content": "..."}}
{"type": "done", "data": null}
{"type": "error", "data": "error message"}
```

## Ports

| Service | Port |
|---------|------|
| Frontend (Vite dev) | 18766 |
| Backend API + WebSocket | 18765 |

Vite proxies `/api` to the backend in dev mode. WebSocket connects directly via `window.location.host`.

## Code Style

- No semicolons, single quotes, 2-space indentation
- Components: PascalCase, hooks: camelCase with `use` prefix
- Backend uses ESM (`"type": "module"` in package.json)
- All CSS is inline (JSX `<style>` template literals) — no external CSS framework
- Mobile-first: 44px min touch targets, `env(safe-area-inset-*)` support

## Environment

- Node.js 18+
- Backend `.env` (see `backend/.env.example`): `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `PORT` (default 18765), optional `LOG_LEVEL` (default `info`)
- Supports third-party APIs (e.g., ZhiPu/智谱) via `ANTHROPIC_BASE_URL` override
