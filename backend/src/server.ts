import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { v4 as uuidv4 } from 'uuid'
import { agentService } from './agent-service.js'
import { router } from './routes.js'
import { logger } from './logger.js'
import { saveMessages, type StoredMessage } from './store.js'
import type { AgentConfig } from './types.js'
import { wsMessageSchema } from './types.js'

/**
 * Express 应用实例
 */
const app = express()

/**
 * HTTP 服务器实例
 */
const server = createServer(app)

/**
 * WebSocket 服务器实例
 * 路径: /ws
 */
const wss = new WebSocketServer({ server, path: '/ws' })

/**
 * 服务端口
 * 从环境变量读取，默认 18765
 */
const PORT = parseInt(process.env.PORT || '18765', 10)

/**
 * 允许的跨域来源
 * 开发环境下允许所有来源
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : true // Allow all origins in development/LAN by default

// ============================================
// Express 中间件
// ============================================

/**
 * CORS 中间件
 * 允许跨域请求
 */
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

/**
 * JSON 解析中间件
 * 限制请求体大小为 1MB
 */
app.use(express.json({ limit: '1mb' }))

// 速率限制：每分钟最多 100 次请求
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', limiter)

/**
 * 请求日志中间件
 * 记录所有 HTTP 请求
 */
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, 'HTTP request')
  next()
})

// API 路由
app.use('/api', router)

/**
 * 全局错误处理中间件
 * 捕获未处理的错误并返回 500 响应
 */
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled request error')
  res.status(500).json({ error: 'Internal server error' })
})

// ============================================
// WebSocket 处理
// ============================================

/**
 * 安全发送 WebSocket 消息
 * 检查连接状态后才发送
 *
 * @param ws - WebSocket 连接
 * @param data - 要发送的数据
 */
function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

/**
 * 初始化超时时间（毫秒）
 * 连接后必须在 10 秒内发送 init 消息
 */
const INIT_TIMEOUT_MS = 10000

/**
 * 心跳间隔（毫秒）
 * 每 30 秒发送一次 ping
 */
const HEARTBEAT_INTERVAL_MS = 30000

/**
 * WebSocket 连接处理
 *
 * 处理以下消息类型：
 * - init: 初始化会话
 * - prompt: 发送用户消息
 * - interrupt: 中断响应
 * - close: 关闭会话
 */
wss.on('connection', (ws: WebSocket) => {
  // 生成唯一会话 ID
  const sessionId = uuidv4()

  /** 是否已完成初始化 */
  let isInitialized = false

  /** 当前关联的会话 ID */
  let currentConversationId: string | null = null

  /** 消息累加器（用于持久化） */
  const messageAccumulator: StoredMessage[] = []

  // 初始化超时处理
  const initTimeout = setTimeout(() => {
    if (!isInitialized) {
      logger.warn('WebSocket closed: no init message received')
      ws.close(4002, 'Initialization timeout')
    }
  }, INIT_TIMEOUT_MS)

  // 心跳机制
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

  // 消息处理
  ws.on('message', async (data: Buffer) => {
    try {
      const raw = JSON.parse(data.toString())

      // 验证消息格式
      const parseResult = wsMessageSchema.safeParse(raw)
      if (!parseResult.success) {
        safeSend(ws, { type: 'error', data: 'Invalid message format', sessionId })
        return
      }
      const message = parseResult.data

      switch (message.type) {
        // ====================
        // 初始化消息
        // ====================
        case 'init': {
          clearTimeout(initTimeout)
          const { workDir } = message.data || {}

          const config: AgentConfig = {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
            },
          }

          await agentService.createSession(sessionId, config)
          isInitialized = true

          logger.info({ sessionId, workDir }, 'Session initialized')
          safeSend(ws, { type: 'initialized', data: { sessionId } })
          break
        }

        // ====================
        // 用户提示消息
        // ====================
        case 'prompt': {
          if (!isInitialized) {
            safeSend(ws, { type: 'error', data: 'Session not initialized', sessionId })
            return
          }

          const { prompt, workDir, conversationId } = message.data
          currentConversationId = conversationId || null

          logger.info({ sessionId, promptLength: prompt?.length, conversationId }, 'Prompt received')

          const config: AgentConfig = { workDir }

          // 记录用户消息
          const userMsg: StoredMessage = {
            id: `${Date.now()}-user`,
            role: 'user',
            content: prompt,
            type: 'text',
            timestamp: Date.now(),
          }
          messageAccumulator.push(userMsg)

          // 流式处理 Agent 响应
          await agentService.streamMessage(sessionId, prompt, config, msg => {
            safeSend(ws, msg)

            // 收集消息用于持久化
            if (msg.type === 'message' || msg.type === 'thinking' || msg.type === 'tool_call' || msg.type === 'tool_result') {
              const d = msg.data as Record<string, unknown>
              messageAccumulator.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role: (d.role as string) || 'assistant',
                content: typeof d.content === 'string' ? d.content : JSON.stringify(d.content ?? ''),
                type: msg.type === 'tool_call' ? 'tool_use' : (msg.type as string),
                metadata: d.toolName ? { toolId: d.toolId, toolName: d.toolName, toolInput: d.toolInput, toolOutput: d.toolOutput } : undefined,
                timestamp: Date.now(),
              })
            }

            // 完成后保存消息
            if (msg.type === 'done' && currentConversationId) {
              const msgsToSave = [...messageAccumulator]
              messageAccumulator.length = 0
              saveMessages(currentConversationId, msgsToSave).catch(err => {
                logger.error({ err, conversationId: currentConversationId }, 'Failed to save messages')
              })
            }
          })
          break
        }

        // ====================
        // 中断消息
        // ====================
        case 'interrupt': {
          logger.info({ sessionId }, 'Session interrupted')
          agentService.interruptSession(sessionId)
          break
        }

        // ====================
        // 关闭消息
        // ====================
        case 'close': {
          await agentService.closeSession(sessionId)
          ws.close()
          break
        }

        default:
          safeSend(ws, { type: 'error', data: `Unknown message type`, sessionId })
      }
    } catch (error) {
      logger.error({ err: error, sessionId }, 'WebSocket message error')
      safeSend(ws, {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      })

      // 错误时保存已收集的消息
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

  // 连接关闭处理
  ws.on('close', async () => {
    clearInterval(heartbeat)
    clearTimeout(initTimeout)

    // 保存已收集的消息
    if (currentConversationId && messageAccumulator.length > 0) {
      try {
        await saveMessages(currentConversationId, messageAccumulator)
        messageAccumulator.length = 0
      } catch (err) {
        logger.error({ err }, 'Failed to save messages on disconnect')
      }
    }

    logger.info({ sessionId }, 'WebSocket disconnected')
    await agentService.closeSession(sessionId)
  })

  ws.on('error', err => {
    logger.error({ err, sessionId }, 'WebSocket error')
  })

  // 发送连接成功消息
  safeSend(ws, { type: 'connected', data: { sessionId } })
})

// ============================================
// 优雅关闭
// ============================================

/** 是否正在关闭 */
let isShuttingDown = false

/**
 * 关闭服务器
 *
 * @param signal - 接收到的信号
 */
function shutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info({ signal }, 'Shutting down...')

  // 关闭所有 WebSocket 连接
  wss.clients.forEach(ws => ws.close())

  // 关闭 HTTP 服务器
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })

  // 超时强制关闭
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

// 监听关闭信号
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ============================================
// 启动服务器
// ============================================

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started')
})
