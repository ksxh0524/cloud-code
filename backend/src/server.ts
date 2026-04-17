import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import { agentService } from './agent-service.js'
import { router } from './routes.js'
import type { WebSocketMessage, AgentConfig } from './types.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

const PORT = process.env.PORT || 18765

// 中间件
app.use(cors())
app.use(express.json())

// REST API
app.use('/api', router)

// WebSocket 连接处理
wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection')

  const sessionId = uuidv4()

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString())
      console.log('Received message:', message.type)

      switch (message.type) {
        case 'init': {
          const { workDir, env } = message.data
          const config: AgentConfig = {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
              ...env,
            },
          }
          await agentService.createSession(sessionId, config)
          ws.send(
            JSON.stringify({
              type: 'initialized',
              data: { sessionId },
            })
          )
          break
        }

        case 'prompt': {
          const { prompt, workDir, env } = message.data
          const config: AgentConfig = {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || '',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || '',
              ...env,
            },
          }

          await agentService.streamMessage(sessionId, prompt, config, (msg: WebSocketMessage) => {
            ws.send(JSON.stringify(msg))
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
          ws.send(
            JSON.stringify({
              type: 'error',
              data: `Unknown message type: ${message.type}`,
              sessionId,
            })
          )
      }
    } catch (error) {
      console.error('Error handling message:', error)
      ws.send(
        JSON.stringify({
          type: 'error',
          data: error instanceof Error ? error.message : 'Unknown error',
          sessionId,
        })
      )
    }
  })

  ws.on('close', async () => {
    console.log('WebSocket connection closed')
    await agentService.closeSession(sessionId)
  })

  ws.on('error', error => {
    console.error('WebSocket error:', error)
  })

  ws.send(
    JSON.stringify({
      type: 'connected',
      data: { sessionId },
    })
  )
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`REST API: http://localhost:${PORT}/api`)
  console.log(`WebSocket: ws://localhost:${PORT}`)
})
