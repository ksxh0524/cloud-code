import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { agentService } from './agent-service.js'
import { router } from './routes.js'
import type { AgentConfig } from './types.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const PORT = parseInt(process.env.PORT || '18765', 10)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// REST API
app.use('/api', router)

// Safe WebSocket send helper
function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  const sessionId = uuidv4()

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'init': {
          const { workDir } = message.data
          const clientEnv = message.data.env || {}
          const env: Record<string, string> = {}
          // Only allow specific env vars from client
          if (clientEnv.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = clientEnv.ANTHROPIC_BASE_URL
          if (clientEnv.ANTHROPIC_AUTH_TOKEN) env.ANTHROPIC_AUTH_TOKEN = clientEnv.ANTHROPIC_AUTH_TOKEN

          const config: AgentConfig = {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
              ...env,
            },
          }
          await agentService.createSession(sessionId, config)
          safeSend(ws, { type: 'initialized', data: { sessionId } })
          break
        }

        case 'prompt': {
          const { prompt, workDir } = message.data
          const config: AgentConfig = {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
            },
          }

          await agentService.streamMessage(sessionId, prompt, config, msg => {
            safeSend(ws, msg)
          })
          break
        }

        case 'interrupt': {
          agentService.interruptSession(sessionId)
          break
        }

        case 'close': {
          await agentService.closeSession(sessionId)
          ws.close()
          break
        }

        default:
          safeSend(ws, { type: 'error', data: `Unknown message type: ${message.type}`, sessionId })
      }
    } catch (error) {
      safeSend(ws, {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      })
    }
  })

  ws.on('close', async () => {
    await agentService.closeSession(sessionId)
  })

  ws.on('error', () => {
    // Connection errors handled by close event
  })

  safeSend(ws, { type: 'connected', data: { sessionId } })
})

// Graceful shutdown
function shutdown() {
  wss.clients.forEach(ws => ws.close())
  server.close(() => {
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`REST API: http://localhost:${PORT}/api`)
  console.log(`WebSocket: ws://localhost:${PORT}/ws`)
})
