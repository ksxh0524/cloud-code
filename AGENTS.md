# Cloud Code - Agent Development Guide

## Project Overview

Cloud Code is a web-based mobile interface for Claude Code CLI. It consists of:
- **Backend**: Hono (Node.js) + SQLite + WebSocket server (port 18765)
- **Frontend**: React 19 + Vite + TypeScript (port 18766)
- **Shared**: Common TypeScript types

## Build Commands

```bash
# Install dependencies
pnpm install

# Development (runs both frontend and backend)
pnpm dev

# Build production
pnpm build

# Start production server
pnpm start
```

### Workspace-specific Commands

```bash
# Backend only
pnpm --filter backend dev      # Development with hot reload (tsx watch)
pnpm --filter backend build    # Compile TypeScript
pnpm --filter backend start    # Run compiled code

# Frontend only
pnpm --filter frontend dev     # Vite dev server
pnpm --filter frontend build   # Production build
pnpm --filter frontend preview # Preview production build
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

**Backend** (`backend/tsconfig.json`):
- Target: ES2022
- Module: ES2022 with bundler resolution
- Strict mode: OFF (`strict: false`, `noImplicitAny: false`)
- Output: `dist/` directory

**Frontend** (`frontend/tsconfig.json`):
- Target: ES2020
- Strict mode: ON (`strict: true`)
- Enables: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- JSX: `react-jsx`

### Import Conventions

**Backend** (ES modules with .js extensions):
```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import webRoutes from './routes/web.js'  // Note: .js extension required
import type { Conversation } from '../../../shared/types.js'
```

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
// Backend: Log and return JSON error
app.get('/api/data', async (c) => {
  try {
    const data = await fetchData()
    return c.json({ data })
  } catch (err) {
    console.error('Failed to fetch:', err)
    return c.json({ error: err.message }, 500)
  }
})

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

### Database Models

Located in `backend/src/models/`:
- Use SQLite via `sql.js`
- Export CRUD functions (e.g., `createConversation`, `getConversation`)
- Initialize in `backend/src/db/index.ts`

### WebSocket Events

Shared types in `shared/types.ts`:
```typescript
export type WSEvent =
  | { type: 'message'; conversationId: string; data: Message }
  | { type: 'tool'; conversationId: string; data: ToolCall }
  | { type: 'status'; conversationId: string; data: { status: string } }
```

## Architecture Notes

- Monorepo with pnpm workspaces (`pnpm-workspace.yaml`)
- Shared types referenced relatively from backend
- Frontend proxies API calls to backend via Vite config
- WebSocket for real-time terminal communication
- CLI service spawns processes via Python PTY wrapper
- Terminal uses xterm.js with fit addon

## Important Paths

- Frontend entry: `frontend/src/main.tsx`
- Backend entry: `backend/src/index.ts`
- Shared types: `shared/types.ts`
- Database: `backend/data.db` (SQLite, auto-created)
- Test directory: `test/`
