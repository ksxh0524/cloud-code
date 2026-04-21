# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloud Code is a mobile-optimized web interface for Claude Code. Users interact with the Claude Agent SDK through a browser-based chat UI, with WebSocket streaming for real-time responses. Designed for use on mobile phones over a local network (LAN).

## Tech Stack

- **Backend**: Node.js + Express 4 + `@anthropic-ai/claude-agent-sdk` + WebSocket (`ws`)
- **Frontend**: React 19 + Vite 6 + TypeScript + `@headlessui/react`
- **Validation**: Zod on both REST endpoints and WebSocket messages
- **Data**: `~/.cloud-code/data.json` (conversations + config) + `~/.cloud-code/messages/{id}.json` (per-conversation messages)
- **Testing**: Vitest (backend unit), Playwright (E2E)

## Common Commands

```bash
# Install all dependencies (root installs both workspaces)
pnpm install

# Development (both at once)
pnpm dev:all

# Development (separate terminals)
cd backend && pnpm dev          # Backend on port 18765 (tsx watch)
pnpm dev                        # Frontend on port 18766 (Vite)

# Build
pnpm build                      # Frontend + Backend production build

# Test
cd backend && pnpm test                          # Backend unit tests (Vitest)
cd backend && pnpm test:watch                    # Backend tests in watch mode
npx playwright test                              # All E2E tests
npx playwright test test/mobile-ui.spec.ts       # Single E2E file
npx playwright test --headed                     # Visible browser

# Lint & format
pnpm lint && pnpm lint:fix
pnpm format
```

## Architecture

### Backend (`backend/src/`)

- `server.ts` — Express + WebSocket server on port 18765. CORS (configurable via `ALLOWED_ORIGINS`), rate limiting (100 req/min), request logging. WebSocket connections require `init` message within 10s or are closed. Heartbeat: 30s ping/pong interval. Accumulated messages saved to disk on stream completion, error, or disconnect.
- `agent-service.ts` — Singleton `AgentService` manages SDK sessions in a `Map`. Calls `query()` with `persistSession: true`, streams via `for await...of`. Default tools: `Read`, `Edit`, `Bash`, `Glob`, `Grep`. Default max turns: 50. `query.close()` is always awaited to prevent resource leaks.
- `routes.ts` — REST API: conversations CRUD, work directory listing, app config. All handlers wrapped in `asyncHandler()` for Express 4 async error propagation. Zod schemas validate all mutating endpoints.
- `store.ts` — JSON file persistence with async `fs/promises` I/O. Atomic writes (write to `.tmp` then `rename`). Custom async mutex serializes concurrent writes via `withLock()`. Path security via `ALLOWED_ROOTS` allowlist. `loadMessages()` is synchronous; `saveMessages()` is async.
- `auth.ts` — Optional API key auth. `requireApiKey()` middleware for REST (`x-api-key` header or `Authorization: Bearer`). `validateApiKey()` for WebSocket auth during `init` message.
- `types.ts` — `WebSocketMessage`, `AgentConfig` interfaces. Zod schemas `wsInitSchema`, `wsPromptSchema`, `wsInterruptSchema`, `wsCloseSchema` combined into `wsMessageSchema` discriminated union for WebSocket message validation.
- `logger.ts` — Pino logger with `pino-pretty` in development. Level via `LOG_LEVEL` env var.

### Frontend (`frontend/src/`)

- `App.tsx` — Routes: `/` → ChatNew, `/settings` → Settings
- `pages/ChatNew.tsx` — Main chat page. Monolithic component managing conversations, messages, streaming state. Uses `useAgentWebSocket` hook. Filters incoming messages by sessionId to prevent stale stream messages.
- `hooks/useAgentWebSocket.ts` — WebSocket hook. `connect` has empty deps array — uses refs for `workDir` to avoid reconnecting on conversation switch. Auth via `apiKey` in `init` message from localStorage. Exponential backoff reconnect (up to 10 retries, max 30s).
- `hooks/useMessages.ts`, `useConversations.ts`, `useAutoScroll.ts` — Extracted hooks (not yet integrated into ChatNew).
- `components/chat/ChatLayout.tsx` — Extracted layout component (not yet integrated).
- `lib/fetch.ts` — `authFetch()` wraps `fetch()` and attaches `x-api-key` header from `localStorage.getItem('api_key')`.
- All components use inline `<style>` JSX template literals (no external CSS framework).

### Data Flow

1. User creates conversation → `POST /api/conversations` → saved to `~/.cloud-code/data.json`
2. Frontend opens WebSocket → sends `init` with `workDir` and `apiKey` → receives `connected` then `initialized`
3. User sends prompt → WebSocket `prompt` message with `conversationId` → `agentService.streamMessage()`
4. SDK streams messages → WebSocket back to frontend → rendered as MessageItems (memoized with `React.memo`)
5. On `done`, accumulated messages saved to `~/.cloud-code/messages/{conversationId}.json`
6. On error or disconnect, messages are also saved (partial preservation)

### WebSocket Protocol

Client → Server (validated by Zod `wsMessageSchema`):
```json
{"type": "init", "data": {"workDir": "/path", "apiKey": "optional"}}
{"type": "prompt", "data": {"prompt": "text", "workDir": "/path", "conversationId": "optional"}}
{"type": "interrupt"}
{"type": "close"}
```

Server → Client:
```json
{"type": "connected", "data": {"sessionId": "uuid"}}      // immediate on WebSocket open
{"type": "initialized", "data": {"sessionId": "uuid"}}     // after successful init
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

Vite proxies `/api` to the backend and `/ws` for WebSocket in dev mode.

## Code Style

- No semicolons, single quotes, 2-space indentation, trailing commas (es5), print width 100
- Components: PascalCase, hooks: camelCase with `use` prefix
- Backend uses ESM (`"type": "module"` in package.json)
- All CSS is inline (JSX `<style>` template literals)
- Mobile-first: 44px min touch targets, `env(safe-area-inset-*)` support
- TypeScript strict mode in both frontend and backend

## Environment

- Node.js 18+ (pinned in `.nvmrc` and `engines` field)
- Backend `.env` (see `backend/.env.example`):
  - `ANTHROPIC_BASE_URL` — API base URL (supports ZhiPu/智谱 and other providers)
  - `ANTHROPIC_AUTH_TOKEN` — API authentication key
  - `PORT` — Backend port (default 18765)
  - `LOG_LEVEL` — Logging level (default `info`)
  - `API_KEY` — Optional API key for access control
  - `ALLOWED_ORIGINS` — CORS origins, comma-separated (default: allow all, suitable for LAN use)
  - `ANTHROPIC_API_KEY` — Optional native Claude API key
