import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createNodeWebSocket } from '@hono/node-ws'
import webRoutes from './routes/web.js'
import feishuRoutes from './routes/feishu.js'
import { initDb } from './db/index.js'
import { cliService } from './services/cli.service.js'
import * as conversationModel from './models/conversation.js'
import { wsManager } from './services/ws-manager.js'

const port = 18765

// 先初始化数据库，再启动服务器
async function start() {
  console.log('📦 Initializing database...')
  await initDb()

  const app = new Hono()

  // 创建 WebSocket 服务器
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app })

  // 中间件
  app.use('*', logger())
  app.use('*', cors({
    origin: ['http://localhost:18766', 'http://127.0.0.1:18766'],
    credentials: true
  }))

  // 路由
  app.route('/', webRoutes)
  app.route('/feishu', feishuRoutes)

  // WebSocket 路由
  app.get('/ws', upgradeWebSocket((c) => {
    return {
      onOpen(evt, ws) {
        const url = new URL(c.req.url)
        const conversationId = url.searchParams.get('conversationId')

        console.log(`[WS] Connection opened for conversation: ${conversationId}`)

        if (conversationId) {
          wsManager.addClient(conversationId, ws as any)

          // 启动 CLI 会话
          const conversation = conversationModel.getConversation(conversationId)
          if (conversation) {
            cliService.startSession(conversationId, conversation.workDir, conversation.cliType)
              .catch(err => {
                console.error('Failed to start session:', err)
                wsManager.broadcast(conversationId, {
                  type: 'output',
                  conversationId,
                  data: { output: `\r\n[Error: Failed to start session: ${err.message}]\r\n` }
                })
              })
          }
        }
      },
      onMessage(evt, ws) {
        try {
          const data = JSON.parse(evt.data.toString())
          const conversationId = data.conversationId

          if (data.type === 'input' && conversationId) {
            // 转发输入到 CLI
            cliService.sendInput(conversationId, data.data.input)
          }
        } catch (e) {
          console.error('Invalid message:', e)
        }
      },
      onClose(evt, ws) {
        const url = new URL(c.req.url)
        const conversationId = url.searchParams.get('conversationId')

        console.log(`[WS] Connection closed for conversation: ${conversationId}`)

        if (conversationId) {
          wsManager.removeClient(conversationId, ws as any)

          // 如果没有客户端了，停止会话
          if (!wsManager.hasClients(conversationId)) {
            cliService.stopSession(conversationId)
          }
        }
      }
    }
  }))

  // 健康检查
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  console.log(`🚀 Server starting on http://localhost:${port}`)

  const server = serve({
    fetch: app.fetch,
    port
  })

  // 注入 WebSocket 升级处理（在服务器创建之后）
  injectWebSocket(server)

  console.log(`✅ Server ready on http://localhost:${port}`)
}

start().catch(console.error)
