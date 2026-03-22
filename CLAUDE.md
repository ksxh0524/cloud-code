# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Cloud Code is a mobile-optimized web interface for using Claude Code CLI or OpenCode CLI from a browser. It provides a terminal-like experience with xterm.js, allowing users to interact with AI coding assistants from their mobile devices.

## Tech Stack

- **Backend**: Python (FastAPI) + SQLite + pexpect (PTY management)
- **Frontend**: React 19 + Vite + TypeScript + xterm.js
- **Communication**: WebSocket for real-time terminal I/O
- **Testing**: Playwright E2E tests

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Start backend (port 18765)
cd backend_py
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 18765 --reload

# Start frontend (port 18766) - in another terminal
pnpm dev

# Access the app
open http://localhost:18766
```

### Build & Test

```bash
# Build frontend for production
pnpm build

# Run E2E tests (requires running backend)
npx playwright test

# Run specific test file
npx playwright test test/python-backend.spec.ts

# Run tests in headed mode
npx playwright test --headed
```

## Architecture

### Backend (FastAPI)

- `app/main.py` - Application entry, WebSocket endpoint, lifespan management
- `app/routers/web.py` - REST API routes (conversations, config, sessions)
- `app/services/cli_service.py` - **Core**: PTY session management using pexpect
- `app/services/ws_manager.py` - WebSocket client management per conversation
- `app/database.py` - SQLAlchemy setup with SQLite
- `app/models/` - SQLAlchemy models (Conversation, Message, Config)

### Frontend (React)

- `frontend/src/pages/Chat.tsx` - Main page with sidebar and terminal
- `frontend/src/components/Terminal.tsx` - **Core**: xterm.js terminal with WebSocket
- `frontend/src/components/ConversationList.tsx` - Sidebar conversation list
- `frontend/src/components/NewConversationModal.tsx` - Create new conversation
- `frontend/src/hooks/useWebSocket.ts` - WebSocket hook for message handling
- `frontend/src/types.ts` - TypeScript type definitions

### Key Data Flow

1. User creates conversation → POST `/api/conversations` → saved to SQLite
2. Frontend opens WebSocket to `/ws?conversationId=xxx`
3. Backend starts PTY process (claude/opencode) via pexpect in work_dir
4. PTY output → WebSocket → xterm.js renders in browser
5. User input in xterm → WebSocket → pexpect sends to PTY

### Session Management

- Sessions are keyed by `conversation_id`
- Existing running sessions are reused when reconnecting
- Sessions are terminated when no WebSocket clients remain
- CLI processes are killed via process group (SIGTERM → SIGKILL)

## Ports

| Service | Port |
|---------|------|
| Frontend (dev) | 18766 |
| Backend API | 18765 |
| WebSocket | 18765/ws |

## Environment Requirements

- Node.js 18+
- Python 3.10+
- Claude Code CLI or OpenCode CLI installed

## Documentation

- [API Documentation](docs/API.md) - REST and WebSocket protocols
- [Architecture](docs/ARCHITECTURE.md) - System design details
- [Deployment](docs/DEPLOYMENT.md) - Production deployment guide
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
