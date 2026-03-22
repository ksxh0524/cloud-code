import { Hono } from 'hono'
import * as conversationModel from '../models/conversation.js'
import * as configModel from '../models/config.js'
import { cliService } from '../services/cli.service.js'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const app = new Hono()

// 获取目录下的子目录
function getDirectories(path: string): string[] {
  if (!existsSync(path)) return []

  try {
    const entries = readdirSync(path, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
  } catch {
    return []
  }
}

// 获取支持的 CLI 类型
app.get('/api/cli-types', (c) => {
  const cliTypes = cliService.getSupportedCliTypes()
  return c.json(cliTypes)
})

// 检查 CLI 是否已安装
app.get('/api/cli-check/:type', async (c) => {
  const cliType = c.req.param('type') as 'claude' | 'opencode'
  const result = await cliService.checkCliInstalled(cliType)
  return c.json(result)
})

// 会话 API
app.get('/api/conversations', (c) => {
  const conversations = conversationModel.listConversations()
  return c.json(conversations)
})

app.post('/api/conversations', async (c) => {
  const { name, workDir, cliType = 'claude' } = await c.req.json()
  const conversation = conversationModel.createConversation(name, workDir, cliType)

  // 预热：立即启动 CLI 会话，不需要等待 WebSocket 连接
  cliService.startSession(conversation.id, workDir, cliType).catch(err => {
    console.error('Failed to prewarm session:', err)
  })

  return c.json(conversation, 201)
})

app.get('/api/conversations/:id', (c) => {
  const id = c.req.param('id')
  const conversation = conversationModel.getConversation(id)
  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }
  return c.json(conversation)
})

app.patch('/api/conversations/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  if (body.name) {
    conversationModel.updateConversation(id, { name: body.name })
  }

  const conversation = conversationModel.getConversation(id)
  return c.json(conversation)
})

app.delete('/api/conversations/:id', (c) => {
  const id = c.req.param('id')
  conversationModel.deleteConversation(id)
  return c.json({ success: true })
})

// 获取工作目录列表（从配置）
app.get('/api/workdirs', (c) => {
  const config = configModel.getConfig()

  // 获取配置的工作目录
  const workDir = config.defaultWorkDir || process.cwd()

  // 获取该目录下的子目录
  const subdirs = getDirectories(workDir)

  // 构建工作目录列表
  const workdirs = [
    { path: workDir, name: workDir.split('/').pop() || workDir, isConfig: true },
    ...subdirs.map(name => ({
      path: join(workDir, name),
      name: name,
      isConfig: false
    }))
  ]

  return c.json(workdirs)
})

// 获取指定目录的子目录
app.get('/api/directories', (c) => {
  const path = c.req.query('path') as string

  if (!path || !existsSync(path)) {
    return c.json([])
  }

  const subdirs = getDirectories(path)

  return c.json(subdirs)
})

// 配置 API
app.get('/api/config', (c) => {
  const config = configModel.getConfig()
  return c.json(config)
})

app.put('/api/config', async (c) => {
  const body = await c.req.json()

  if (body.feishu) {
    configModel.updateFeishuConfig(body.feishu)
  }
  if (body.defaultWorkDir) {
    configModel.setConfig('defaultWorkDir', body.defaultWorkDir)
  }

  const config = configModel.getConfig()
  return c.json(config)
})

export default app
