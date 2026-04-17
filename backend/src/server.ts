import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { agentService } from './agent-service.js'
import { router } from './routes.js'
import { logger } from './logger.js'
import { requireApiKey, validateWsApiKey } from './auth.js'
import { saveMessages, type StoredMessage } from './store.js'
import type { AgentConfig } from './types.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const PORT = parseInt(process.env.PORT || '18765', 10)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Request logging middleware
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, 'HTTP request')
  next()
})

app.use('/api', requireApiKey, router)

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  if (!validateWsApiKey(req.url)) {
    logger.warn('WebSocket connection rejected: invalid API key')
    ws.close(4001, 'Unauthorized')
    return
  }

  const sessionId = uuidv4()
  logger.info({ sessionId }, 'WebSocket connected')

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'init': {
          const { workDir } = message.data
          const clientEnv = message.data.env || {}
          const env: Record<string, string> = {}
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
          logger.info({ sessionId, workDir }, 'Session initialized')
          safeSend(ws, { type: 'initialized', data: { sessionId } })
          break
        }

        case 'prompt': {
          const { prompt, workDir, conversationId } = message.data
          logger.info({ sessionId, promptLength: prompt?.length, conversationId }, 'Prompt received')

          const config: AgentConfig = { workDir }

          // Accumulate messages for persistence
          const messageAccumulator: StoredMessage[] = []
          const userMsg: StoredMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            content: prompt,
            type: 'text',
            timestamp: Date.now(),
          }
          messageAccumulator.push(userMsg)

          await agentService.streamMessage(sessionId, prompt, config, msg => {
            safeSend(ws, msg)

            // Accumulate non-stream messages
            if (msg.type === 'message' || msg.type === 'thinking' || msg.type === 'tool_call' || msg.type === 'tool_result') {
              const data = msg.data as Record<string, unknown>
              messageAccumulator.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role: (data.role as string) || 'assistant',
                content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content ?? ''),
                type: msg.type === 'tool_call' ? 'tool_use' : (msg.type as string),
                metadata: data.toolName ? { toolName: data.toolName, toolInput: data.toolInput, toolOutput: data.toolOutput } : undefined,
                timestamp: Date.now(),
              })
            }

            // Save messages on completion
            if (msg.type === 'done' && conversationId) {
              try {
                saveMessages(conversationId, messageAccumulator)
              } catch (err) {
                logger.error({ err, conversationId }, 'Failed to save messages')
              }
            }
          })
          break
        }

        case 'interrupt': {
          logger.info({ sessionId }, 'Session interrupted')
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
      logger.error({ err: error, sessionId }, 'WebSocket message error')
      safeSend(ws, {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      })
    }
  })

  ws.on('close', async () => {
    logger.info({ sessionId }, 'WebSocket disconnected')
    await agentService.closeSession(sessionId)
  })

  ws.on('error', err => {
    logger.error({ err, sessionId }, 'WebSocket error')
  })

  safeSend(ws, { type: 'connected', data: { sessionId } })
})

// Graceful shutdown
let isShuttingDown = false

function shutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true
  logger.info({ signal }, 'Shutting down...')

  wss.clients.forEach(ws => ws.close())
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started')
})
