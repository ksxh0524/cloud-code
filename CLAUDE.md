# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloud Code is a mobile-optimized web interface for Claude Code. Users interact with the Claude Agent SDK through a browser-based chat UI, with WebSocket streaming for real-time responses. Designed for use on mobile phones over a local network (LAN).

## Tech Stack

- **Backend**: Node.js + Express 4 + `@anthropic-ai/claude-agent-sdk` + WebSocket (`ws`) + helmet
- **Frontend**: React 19 + Vite 6 + TypeScript + `@headlessui/react` + CSS Modules
- **Validation**: Zod on both REST endpoints and WebSocket messages
- **Data**: `~/.cloud-code/data.json` (conversations + config) + `~/.cloud-code/messages/{id}.json` (per-conversation messages)
- **Testing**: Vitest (backend & frontend unit), Playwright (E2E)

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
cd frontend && pnpm test                         # Frontend unit tests (Vitest)
cd frontend && pnpm test:watch                   # Frontend tests in watch mode
npx playwright test                              # All E2E tests
npx playwright test test/mobile-ui.spec.ts       # Single E2E file
npx playwright test --headed                     # Visible browser

# Lint & format
pnpm lint && pnpm lint:fix
pnpm format
```

## Architecture

### Backend (`backend/src/`)

- `server.ts` — Express + WebSocket server on port 18765. Helmet security headers. CORS (configurable via `ALLOWED_ORIGINS`, default `['http://localhost:18766']`). Rate limiting (100 req/min). Request logging with status code and duration. WebSocket: `maxPayload` 1MB, message rate limit (60/min per connection), `init` message required within 10s. Heartbeat: 30s ping/pong interval. Accumulated messages saved to disk on stream completion, error, or disconnect.
- `agent-service.ts` — Singleton `AgentService` manages SDK sessions in a `Map`. Calls `query()` with `persistSession: true`, `settingSources: ['user', 'project']`, `includePartialMessages: true`. Reads `~/.claude/mcp.json` for MCP server config. Streams via `for await...of` with `try/finally` cleanup. Supports `AbortController` per session for interruption. Default tools: `Read`, `Edit`, `Bash`, `Glob`, `Grep`. Default max turns: 50.
- `routes.ts` — REST API: conversations CRUD, work directory listing, app config. All handlers wrapped in `asyncHandler()` for Express 4 async error propagation. Zod schemas validate all mutating endpoints including workDir path security checks. 404 catch-all for unknown routes.
- `store.ts` — JSON file persistence with async `fs/promises` I/O. Atomic writes (write to `.tmp` then `rename`). Custom async mutex serializes concurrent writes via `withLock()`. Path security via `ALLOWED_ROOTS` allowlist. UUID validation on conversation IDs. All file operations are async (`loadMessages`, `saveMessages`, `deleteMessages`).
- `auth.ts` — Optional API key auth using `crypto.timingSafeEqual` for timing-safe comparison. `requireApiKey()` middleware for REST (`x-api-key` header or `Authorization: Bearer`). `validateApiKey()` for WebSocket auth during `init` message.
- `types.ts` — `WebSocketMessage`, `AgentConfig` interfaces. Zod schemas `wsInitSchema`, `wsPromptSchema`, `wsInterruptSchema`, `wsCloseSchema` combined into `wsMessageSchema` discriminated union for WebSocket message validation.
- `logger.ts` — Pino logger with `pino-pretty` in development. Level via `LOG_LEVEL` env var.

### Frontend (`frontend/src/`)

- `App.tsx` — Routes: `/` → ChatNew, `/settings` → Settings (lazy-loaded). Wrapped in `ErrorBoundary`.
- `pages/ChatNew.tsx` — Main chat page. Manages conversations, messages, streaming state. Uses `useAgentWebSocket` hook with typed `WsServerMessage` callback. Filters incoming messages by sessionId. Key callbacks wrapped in `useCallback`.
- `hooks/useAgentWebSocket.ts` — WebSocket hook with message queue for reconnect resilience. Exponential backoff reconnect (up to 10 retries, max 30s). Auth via `apiKey` in `init` message. Max queue size: 10 messages.
- `hooks/useMessages.ts` — Manages message state with token-level streaming via `streamingContentRef`. Handles all `WsServerMessage` types. `getHistoryForPrompt()` filters out thinking/tool messages.
- `hooks/useConversations.ts` — Manages conversation CRUD with auto-load on mount.
- `hooks/useAutoScroll.ts` — Auto-scroll hook for message list.
- `components/ErrorBoundary.tsx` — React Error Boundary with retry UI.
- `components/chat/ChatLayout.tsx` — Layout component.
- `lib/fetch.ts` — `authFetch()` wraps `fetch()` and attaches `x-api-key` header from `localStorage.getItem('api_key')`.
- `types.ts` — `WsServerMessage` discriminated union type for type-safe WebSocket message handling.
- **CSS Architecture**: All components use CSS Modules (`*.module.css`). Design tokens in `styles/tokens.css`, shared animations in `styles/animations.css`.

### Data Flow

1. User creates conversation → `POST /api/conversations` → saved to `~/.cloud-code/data.json`
2. Frontend opens WebSocket → sends `init` with `workDir` and `apiKey` → receives `connected` then `initialized`
3. User sends prompt → WebSocket `prompt` message with `conversationId` → `agentService.streamMessage()`
4. SDK streams messages (including token-level partial via `includePartialMessages`) → WebSocket back to frontend → rendered as MessageItems (memoized with `React.memo`)
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
- CSS Modules: `Component.tsx` → `Component.module.css`, design tokens in `styles/tokens.css`
- Mobile-first: 44px min touch targets, `env(safe-area-inset-*)` support
- TypeScript strict mode in both frontend and backend
- No `any` types — use discriminated unions for WebSocket messages

## Environment

- Node.js 18+ (pinned in `.nvmrc` and `engines` field)
- Backend `.env` (see `backend/.env.example`):
  - `ANTHROPIC_BASE_URL` — API base URL (supports ZhiPu/智谱 and other providers)
  - `ANTHROPIC_AUTH_TOKEN` — API authentication key
  - `PORT` — Backend port (default 18765)
  - `LOG_LEVEL` — Logging level (default `info`)
  - `API_KEY` — Optional API key for access control (timing-safe comparison)
  - `ALLOWED_ORIGINS` — CORS origins, comma-separated (default: `http://localhost:18766`)
  - `ANTHROPIC_API_KEY` — Optional native Claude API key
- SDK automatically reads `~/.claude/settings.json` and `~/.claude/mcp.json` via `settingSources`

## Security

- Helmet security headers enabled
- API key auth (optional) with timing-safe comparison
- CORS defaults to `localhost:18766` only
- WebSocket: maxPayload 1MB, message rate limit, auth on init
- Path traversal protection: UUID validation on conversation IDs, `ALLOWED_ROOTS` on workDir
- Sanitized error messages (no internal details exposed)
