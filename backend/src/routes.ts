import { Router, type Request, type Response } from 'express'
import { execFile } from 'child_process'
import { z } from 'zod'
import { logger } from './logger.js'
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  getConfig,
  updateConfig,
  getWorkDirs,
  getSubDirectories,
  isPathAllowed,
  loadMessages,
  saveMessages,
} from './store.js'

export const router: Router = Router()

// --- Validation schemas ---

const createConversationSchema = z.object({
  name: z.string().min(1).max(100),
  workDir: z.string().min(1),
  cliType: z.enum(['claude', 'opencode']).default('claude'),
})

const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

const updateConfigSchema = z.object({
  feishu: z.object({
    appId: z.string().default(''),
    appSecret: z.string().default(''),
    verifyToken: z.string().default(''),
    encryptKey: z.string().default(''),
  }).optional(),
  defaultWorkDir: z.string().optional(),
})

// --- Routes ---

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const CLI_COMMANDS: Record<string, string> = { claude: 'claude', opencode: 'opencode' }

router.get('/cli-types', (_req: Request, res: Response) => {
  res.json([
    { type: 'claude', name: 'Claude Code', description: 'Anthropic 官方 AI 编程助手' },
    { type: 'opencode', name: 'OpenCode', description: '开源 AI 编程助手' },
  ])
})

router.get('/cli-check/:type', (req: Request, res: Response) => {
  const command = CLI_COMMANDS[req.params.type]
  if (!command) {
    res.status(400).json({ error: `Unknown CLI type: ${req.params.type}` })
    return
  }
  execFile(command, ['--version'], { timeout: 5000 }, (err, stdout) => {
    if (err) {
      res.json({ installed: false })
    } else {
      res.json({ installed: true, version: stdout.trim() })
    }
  })
})

router.get('/conversations', (_req: Request, res: Response) => {
  res.json(listConversations())
})

router.post('/conversations', async (req: Request, res: Response) => {
  const parsed = createConversationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') })
    return
  }
  const conv = await createConversation(parsed.data)
  logger.info({ convId: conv.id }, 'POST /conversations')
  res.status(201).json(conv)
})

router.get('/conversations/:id', (req: Request, res: Response) => {
  const conv = getConversation(req.params.id)
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json(conv)
})

router.patch('/conversations/:id', async (req: Request, res: Response) => {
  const parsed = updateConversationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') })
    return
  }
  const conv = await updateConversation(req.params.id, parsed.data)
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json(conv)
})

router.delete('/conversations/:id', async (req: Request, res: Response) => {
  const ok = await deleteConversation(req.params.id)
  if (!ok) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  logger.info({ convId: req.params.id }, 'DELETE /conversations/:id')
  res.json({ success: true })
})

router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  const conv = getConversation(req.params.id)
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json(loadMessages(req.params.id))
})

router.get('/workdirs', (_req: Request, res: Response) => {
  res.json(getWorkDirs())
})

router.get('/directories', (req: Request, res: Response) => {
  const path = req.query.path as string
  if (!path) {
    res.status(400).json({ error: 'path query parameter is required' })
    return
  }
  if (!isPathAllowed(path)) {
    res.status(403).json({ error: 'Access denied' })
    return
  }
  res.json(getSubDirectories(path))
})

const MASK = '••••••••'

router.get('/config', (_req: Request, res: Response) => {
  const config = getConfig()
  res.json({
    ...config,
    feishu: { ...config.feishu, appSecret: config.feishu.appSecret ? MASK : '' },
  })
})

router.put('/config', async (req: Request, res: Response) => {
  const parsed = updateConfigSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') })
    return
  }
  const updates = { ...parsed.data }
  if (updates.feishu && (updates.feishu.appSecret === MASK || updates.feishu.appSecret === '')) {
    const { appSecret: _, ...rest } = updates.feishu
    updates.feishu = rest as typeof updates.feishu
  }
  const config = await updateConfig(updates)
  res.json({
    ...config,
    feishu: { ...config.feishu, appSecret: config.feishu.appSecret ? MASK : '' },
  })
})
