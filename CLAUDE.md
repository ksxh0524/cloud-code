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
# Install all dependencies
pnpm install
cd backend && pnpm install

# Development (two terminals)
cd backend && pnpm dev          # Backend on port 18765
pnpm dev                        # Frontend on port 18766

# Build
pnpm build                      # Frontend production build
cd backend && pnpm build        # Backend TypeScript compile

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

- `server.ts` — Express + WebSocket server on port 18765. REST routes at `/api/*`, WebSocket at root path.
- `agent-service.ts` — Claude Agent SDK integration. Calls `query()` and streams results back via WebSocket.
- `routes.ts` — REST API: conversations CRUD, CLI type checking, work directory listing, app config.
- `store.ts` — JSON file persistence for conversations and config. Reads/writes `~/.cloud-code/data.json`.
- `types.ts` — Session, Message, WebSocketMessage, AgentConfig interfaces.

### Frontend (`frontend/src/`)

- `App.tsx` — Routes: `/` → ChatNew, `/settings` → Settings
- `pages/ChatNew.tsx` — Main chat page. Manages conversations, messages, WebSocket via `useAgentWebSocket`.
- `pages/Settings.tsx` — Feishu config + default work directory settings.
- `components/ConversationList.tsx` — Sidebar list with rename/delete.
- `components/NewConversationModal.tsx` — CLI selector + directory picker.
- `components/MessageList.tsx` / `MessageItem.tsx` / `ToolCall.tsx` / `CodeBlock.tsx` — Message rendering.
- `components/InputBox.tsx` — Auto-resizing textarea with send/interrupt.
- `components/Modal.tsx` / `CustomSelect.tsx` — UI primitives.
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
- Python: 4-space indentation (per `.editorconfig`)
- Components: PascalCase, hooks: camelCase with `use` prefix
- Types in `frontend/src/types.ts` and `backend/src/types.ts`
- All CSS is inline (JSX `<style>` template literals) — no external CSS framework
- Mobile-first: 44px min touch targets, `env(safe-area-inset-*)` support

## Environment

- Node.js 18+
- Backend requires `.env` with `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`
- Supports third-party APIs (e.g., ZhiPu/智谱) via base URL override
