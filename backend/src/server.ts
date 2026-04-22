import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { v4 as uuidv4 } from 'uuid'
import { agentService } from './agent-service.js'
import { router } from './routes.js'
import { logger } from './logger.js'
import { saveMessages, touchConversation, updateConversation, type StoredMessage, isPathAllowed, UUID_RE } from './store.js'
import type { AgentConfig } from './types.js'
import { wsMessageSchema } from './types.js'
import { requireApiKey, validateApiKey, isAuthEnabled } from './auth.js'

const app = express()

const server = createServer(app)

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 1024 * 1024, // 1MB 限制
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(true)
    } else {
      logger.warn({ origin }, 'WebSocket rejected: disallowed origin')
      callback(false, 403, 'Forbidden')
    }
  },
})

const PORT = parseInt(process.env.PORT || '18765', 10)

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:18766']

// ============================================
// Express 中间件
// ============================================

app.use(helmet())

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

app.use((req, _res, next) => {
  const start = Date.now()
  _res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: _res.statusCode,
      duration: Date.now() - start,
    }, 'HTTP request')
  })
  next()
})

app.use('/api', requireApiKey, router)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled request error')
  // 如果 headers 已发送，则不能再发送响应
  if (res.headersSent) {
    return _next(err)
  }
  res.status(500).json({ error: 'Internal server error' })
})

// ============================================
// WebSocket 处理
// ============================================

/**
 * 脱敏日志数据，移除敏感信息
 */
function sanitizeLogData(str: string): string {
  return str
    .replace(/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"[REDACTED]"')
    .replace(/"api_key"\s*:\s*"[^"]*"/gi, '"api_key":"[REDACTED]"')
    .replace(/"authorization"\s*:\s*"[^"]*"/gi, '"authorization":"[REDACTED]"')
    .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"[REDACTED]"')
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[REDACTED]"')
    .replace(/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[REDACTED]"')
}

const MAX_BUFFERED_AMOUNT = 1024 * 1024 // 1MB backpressure threshold

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    if (ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      logger.warn('WebSocket send buffer full, terminating connection')
      ws.terminate()
      return
    }
    try {
      ws.send(JSON.stringify(data))
    } catch (err) {
      logger.error({ err, dataType: typeof data }, 'Failed to stringify WebSocket message')
      try {
        ws.send(JSON.stringify({ type: 'error', data: 'Message serialization failed' }))
      } catch {
        // 忽略二次失败
      }
    }
  }
}

const INIT_TIMEOUT_MS = 10000
const HEARTBEAT_INTERVAL_MS = 30000
const WS_MSG_LIMIT_PER_MIN = 60

wss.on('connection', (ws: WebSocket) => {
  const sessionId = uuidv4()

  let isInitialized = false

  let currentConversationId: string | null = null

  const messageAccumulator: StoredMessage[] = []

  let sdkSessionId: string | undefined = undefined

  let isProcessing = false

  let conversationHistory: { role: 'user' | 'assistant', content: string, timestamp?: number }[] = []
  const MAX_HISTORY = 100

  // WebSocket 消息速率限制
  let msgCount = 0
  let msgCountReset = Date.now()

  const initTimeout = setTimeout(() => {
    if (!isInitialized) {
      logger.warn('WebSocket closed: no init message received')
      ws.close(4002, 'Initialization timeout')
    }
  }, INIT_TIMEOUT_MS)

  let isAlive = true
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      ws.terminate()
      return
    }
    isAlive = false
    ws.ping()
  }, HEARTBEAT_INTERVAL_MS)

  ws.on('pong', () => { isAlive = true })

  logger.info({ sessionId }, 'WebSocket connected')

  safeSend(ws, { type: 'connected', data: { sessionId, protocolVersion: 1 } })

  ws.on('message', async (data: Buffer) => {
    // 速率检查
    const now = Date.now()
    if (now - msgCountReset > 60000) {
      msgCount = 0
      msgCountReset = now
    }
    msgCount++
    if (msgCount > WS_MSG_LIMIT_PER_MIN) {
      safeSend(ws, { type: 'error', data: 'Rate limit exceeded', sessionId })
      ws.close(4003, 'Rate limit exceeded')
      return
    }

    const messageStartTime = Date.now()
    
    // 检查消息大小
    const MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB
    if (data.length > MAX_MESSAGE_SIZE) {
      safeSend(ws, { type: 'error', data: 'Message too large', sessionId })
      ws.close(4004, 'Message too large')
      return
    }
    
    try {
      const raw = JSON.parse(data.toString())
      logger.debug({
        sessionId,
        messageType: raw.type,
        rawData: sanitizeLogData(data.toString().slice(0, 200)),
      }, 'WebSocket message received')

      const parseResult = wsMessageSchema.safeParse(raw)
      if (!parseResult.success) {
        logger.warn({ sessionId, error: parseResult.error.issues }, 'Invalid message format')
        safeSend(ws, { type: 'error', data: 'Invalid message format', sessionId })
        return
      }
      const message = parseResult.data

      switch (message.type) {
        case 'init': {
          const { workDir, apiKey, ...configOverrides } = message.data || {}

          // WebSocket 认证
          if (!validateApiKey(apiKey)) {
            safeSend(ws, { type: 'error', data: 'Authentication failed', sessionId })
            ws.close(4001, 'Unauthorized')
            return
          }

          // workDir 必填校验
          if (!workDir) {
            safeSend(ws, { type: 'error', data: 'workDir is required', sessionId })
            return
          }

          // 路径安全检查
          if (!isPathAllowed(workDir)) {
            safeSend(ws, { type: 'error', data: 'Work directory not allowed', sessionId })
            return
          }

          const env: Record<string, string> = {}
          if (process.env.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL
          if (process.env.ANTHROPIC_AUTH_TOKEN) env.ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN

          const config: AgentConfig = {
            workDir,
            env,
            ...configOverrides,
          }

          await agentService.createSession(sessionId, config)
          isInitialized = true

          // 认证和初始化成功后才清除超时
          clearTimeout(initTimeout)

          logger.info({ sessionId, workDir }, 'Session initialized')
          safeSend(ws, { type: 'initialized', data: { sessionId } })
          break
        }

        case 'prompt': {
          if (!isInitialized) {
            safeSend(ws, { type: 'error', data: 'Session not initialized', sessionId })
            return
          }

          if (isProcessing) {
            safeSend(ws, { type: 'error', data: 'A prompt is already being processed', sessionId })
            return
          }
          isProcessing = true

          const { prompt, workDir, conversationId, history, sdkSessionId: existingSdkSessionId, ...configOverrides } = message.data

          // 路径安全检查
          if (!isPathAllowed(workDir)) {
            safeSend(ws, { type: 'error', data: 'Work directory not allowed', sessionId })
            return
          }

          currentConversationId = conversationId || null

          // UUID 格式校验
          if (conversationId && !UUID_RE.test(conversationId)) {
            safeSend(ws, { type: 'error', data: 'Invalid conversation ID format', sessionId })
            return
          }

          if (history && Array.isArray(history)) {
            conversationHistory = history
          }

          if (existingSdkSessionId) {
            sdkSessionId = existingSdkSessionId
            logger.debug({ sessionId, sdkSessionId }, 'Using existing SDK session ID')
          }

          logger.info({
            sessionId,
            promptLength: prompt?.length,
            conversationId,
            hasHistory: conversationHistory.length > 0,
            hasSdkSessionId: !!sdkSessionId,
          }, 'Prompt received')

          const config: AgentConfig = {
            workDir,
            sdkSessionId,
          }

          conversationHistory.push({
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
          })
          if (conversationHistory.length > MAX_HISTORY) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY)
          }

          const userMsg: StoredMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            content: prompt,
            type: 'text',
            timestamp: Date.now(),
          }
          messageAccumulator.push(userMsg)

          const streamStartTime = Date.now()
          await agentService.streamMessage(sessionId, prompt, config, msg => {
            safeSend(ws, msg)

            const msgData = msg.data as Record<string, unknown>
            if (msg.type === 'message') {
              logger.debug({
                sessionId,
                role: msgData.role,
                content: typeof msgData.content === 'string'
                  ? String(msgData.content).slice(0, 200) + '...'
                  : 'non-text content',
              }, 'Agent message received')
            } else if (msg.type === 'tool_call') {
              logger.info({
                sessionId,
                toolName: msgData.toolName,
                toolInput: msgData.toolInput,
              }, 'Tool call')
            } else if (msg.type === 'error') {
              logger.error({ sessionId, error: msg.data }, 'Stream error received')
            }

            if (msg.type === 'message' || msg.type === 'thinking' || msg.type === 'tool_call' || msg.type === 'tool_result') {
              const d = msg.data as Record<string, unknown>
              const role = (d.role as string) || 'assistant'
              const content = typeof d.content === 'string' ? d.content : JSON.stringify(d.content ?? '')

              if (msg.type === 'message' && role === 'assistant') {
                conversationHistory.push({
                  role: 'assistant',
                  content,
                  timestamp: Date.now(),
                })
                if (conversationHistory.length > MAX_HISTORY) {
                  conversationHistory = conversationHistory.slice(-MAX_HISTORY)
                }
              }

              messageAccumulator.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content,
                type: msg.type === 'tool_call' ? 'tool_use' : (msg.type as string),
                metadata: d.toolName ? { toolId: d.toolId, toolName: d.toolName, toolInput: d.toolInput, toolOutput: d.toolOutput } : undefined,
                timestamp: Date.now(),
              })

              // 增量保存：每积累 5 条消息保存一次
              if (currentConversationId && messageAccumulator.length >= 5) {
                const msgsToSave = [...messageAccumulator]
                messageAccumulator.length = 0
                saveMessages(currentConversationId, msgsToSave).catch(err => {
                  logger.error({ err, conversationId: currentConversationId }, 'Failed to save messages (incremental)')
                  // 保存失败时恢复消息
                  messageAccumulator.unshift(...msgsToSave)
                })
              }
            }

            if (msg.type === 'done') {
              isProcessing = false
              const doneData = msg.data as Record<string, unknown> | null
              if (doneData?.sdkSessionId && typeof doneData.sdkSessionId === 'string') {
                sdkSessionId = doneData.sdkSessionId
                logger.debug({ sessionId, sdkSessionId }, 'SDK Session ID captured')

                // 持久化 sdkSessionId 到 Conversation
                if (currentConversationId) {
                  updateConversation(currentConversationId, { sdkSessionId }).catch(err => {
                    logger.error({ err, conversationId: currentConversationId }, 'Failed to persist sdkSessionId')
                  })
                }
              }

              const duration = Date.now() - streamStartTime
              logger.info({
                sessionId,
                duration,
                messageCount: messageAccumulator.length,
                sdkSessionId,
              }, 'Stream completed')

              if (currentConversationId && messageAccumulator.length > 0) {
                const msgsToSave = [...messageAccumulator]
                messageAccumulator.length = 0
                saveMessages(currentConversationId, msgsToSave).catch(err => {
                  logger.error({ err, conversationId: currentConversationId }, 'Failed to save messages')
                })
                // 更新会话的最后活动时间
                touchConversation(currentConversationId).catch(err => {
                  logger.error({ err, conversationId: currentConversationId }, 'Failed to touch conversation')
                })
              }
            }
          }, conversationHistory)

          const promptDuration = Date.now() - messageStartTime
          logger.info({ sessionId, duration: promptDuration }, 'Prompt processing completed')
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
          safeSend(ws, { type: 'error', data: `Unknown message type`, sessionId })
      }
    } catch (error) {
      isProcessing = false
      logger.error({ err: error, sessionId }, 'WebSocket message error')
      safeSend(ws, {
        type: 'error',
        data: 'Internal processing error',
        sessionId,
      })

      if (currentConversationId && messageAccumulator.length > 0) {
        try {
          await saveMessages(currentConversationId, messageAccumulator)
          messageAccumulator.length = 0
        } catch (saveErr) {
          logger.error({ err: saveErr }, 'Failed to save messages on error')
        }
      }
    }
  })

  // 修复异步 close handler — 使用 void + catch 防止未处理的 Promise 拒绝
  ws.on('close', () => {
    clearInterval(heartbeat)
    clearTimeout(initTimeout)

    void (async () => {
      try {
        if (currentConversationId && messageAccumulator.length > 0) {
          await saveMessages(currentConversationId, messageAccumulator)
          messageAccumulator.length = 0
        }

        const sessionInfo = await agentService.closeSession(sessionId)
        logger.info({
          sessionId,
          sdkSessionId: sessionInfo?.sdkSessionId,
          historyLength: sessionInfo?.history.length,
        }, 'WebSocket disconnected, session state preserved')
      } catch (err) {
        logger.error({ err, sessionId }, 'Error during WebSocket close cleanup')
      }
    })()
  })

  ws.on('error', err => {
    logger.error({ err, sessionId }, 'WebSocket error')
  })
})

// ============================================
// 优雅关闭
// ============================================

let isShuttingDown = false

async function shutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info({ signal }, 'Shutting down...')

  // 关闭 WebSocket 服务器，不再接受新连接
  wss.close()

  // 等待所有WebSocket连接优雅关闭
  const closePromises = Array.from(wss.clients).map(ws =>
    new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve()
        return
      }

      // 设置关闭超时
      const timeout = setTimeout(() => {
        logger.warn('WebSocket close timeout, terminating')
        ws.terminate()
        resolve()
      }, 2000)

      ws.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })

      ws.close()
    })
  )

  // 等待所有连接关闭，最多5秒
  await Promise.race([
    Promise.all(closePromises),
    new Promise(resolve => setTimeout(resolve, 5000))
  ])

  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })

  setTimeout(() => {
    logger.warn('Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

// ============================================
// 启动服务器
// ============================================

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started')
  if (!isAuthEnabled()) {
    logger.warn('⚠ API_KEY not set — running without authentication. Set API_KEY in .env for production use.')
  }
})
