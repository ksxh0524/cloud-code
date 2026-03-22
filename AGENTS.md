# Cloud Code - Agent Development Guide

## Project Overview

Cloud Code is a web-based mobile interface for Claude Code CLI. It consists of:
- **Backend**: Python (FastAPI) + SQLite + WebSocket server (port 18765)
- **Frontend**: React 19 + Vite + TypeScript (port 18766)

## Build Commands

```bash
# Install dependencies
pnpm install

# Development (frontend only, backend runs separately)
pnpm dev

# Build production
pnpm build
```

### Frontend Commands

```bash
# Frontend only
pnpm --filter frontend dev     # Vite dev server
pnpm --filter frontend build   # Production build
pnpm --filter frontend preview # Preview production build
```

### Backend Commands

```bash
cd backend_py
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 18765 --reload
```

## Test Commands

```bash
# Run all Playwright tests
npx playwright test

# Run specific test file
npx playwright test test/terminal-test.spec.ts

# Run with UI mode
npx playwright test --ui

# Run in headed mode (visible browser)
npx playwright test --headed

# Run specific project (browser)
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

### Test Structure
- E2E tests located in `/test/` directory
- Screenshots saved to `/test/screenshots/`
- Playwright config: `playwright.config.ts`
- Supports Chromium, Firefox, WebKit + mobile variants

## Code Style Guidelines

### TypeScript Configuration

**Frontend** (`frontend/tsconfig.json`):
- Target: ES2020
- Strict mode: ON (`strict: true`)
- Enables: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- JSX: `react-jsx`

### Import Conventions

**Frontend** (standard ES modules):
```typescript
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
```

### Naming Conventions

- **Variables/functions**: camelCase (`conversationId`, `startSession`)
- **Components**: PascalCase (`Terminal.tsx`, `App.tsx`)
- **Interfaces/Types**: PascalCase (`interface Session`, `type CliType`)
- **Files**: camelCase for utilities, PascalCase for components
- **Constants**: UPPER_SNAKE_CASE for true constants

### Formatting

- No semicolons (consistent across codebase)
- Single quotes for strings
- 2-space indentation
- No trailing commas
- Max line length: ~100 characters (implicit)

### Error Handling

```typescript
// Frontend: Try-catch with user feedback
try {
  const result = await api.call()
} catch (e) {
  console.error('Error:', e)
  setError(e.message)
}
```

### React Patterns

- Use functional components with hooks
- Custom hooks for reusable logic (`useWebSocket.ts`)
- Props interfaces defined inline or separately
- Callbacks wrapped in `useCallback` when needed
- Refs for DOM elements and external libraries

### Types

Located in `frontend/src/types.ts`:
```typescript
export interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: CliType
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  status: 'pending' | 'streaming' | 'completed' | 'error'
  createdAt: string
}
```

## Architecture Notes

- Monorepo with pnpm workspaces (`pnpm-workspace.yaml`)
- Frontend proxies API calls to backend via Vite config
- WebSocket for real-time terminal communication
- CLI service spawns processes via Python PTY wrapper
- Terminal uses xterm.js with fit addon

## Important Paths

- Frontend entry: `frontend/src/main.tsx`
- Backend entry: `backend_py/app/main.py`
- Shared types: `frontend/src/types.ts`
- Database: `backend_py/data.db` (SQLite, auto-created)
- Test directory: `test/`