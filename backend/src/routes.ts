import { Router, type Request, type Response } from 'express'
import { execSync } from 'child_process'
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
} from './store.js'

export const router: Router = Router()

// Health
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// CLI types
const CLI_COMMANDS: Record<string, string> = {
  claude: 'claude',
  opencode: 'opencode',
}

router.get('/cli-types', (_req: Request, res: Response) => {
  res.json([
    { type: 'claude', name: 'Claude Code', description: 'Anthropic 官方 AI 编程助手' },
    { type: 'opencode', name: 'OpenCode', description: '开源 AI 编程助手' },
  ])
})

router.get('/cli-check/:type', (req: Request, res: Response) => {
  const cliType = req.params.type
  const command = CLI_COMMANDS[cliType]
  if (!command) {
    res.status(400).json({ error: `Unknown CLI type: ${cliType}` })
    return
  }
  try {
    const version = execSync(`${command} --version 2>&1`, { timeout: 5000 }).toString().trim()
    res.json({ installed: true, version })
  } catch {
    res.json({ installed: false })
  }
})

// Conversations
router.get('/conversations', (_req: Request, res: Response) => {
  res.json(listConversations())
})

router.post('/conversations', (req: Request, res: Response) => {
  const { name, workDir, cliType } = req.body
  if (!name || !workDir) {
    res.status(400).json({ error: 'name and workDir are required' })
    return
  }
  const conv = createConversation({ name, workDir, cliType: cliType || 'claude' })
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

router.patch('/conversations/:id', (req: Request, res: Response) => {
  const conv = updateConversation(req.params.id, req.body)
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json(conv)
})

router.delete('/conversations/:id', (req: Request, res: Response) => {
  const ok = deleteConversation(req.params.id)
  if (!ok) {
    res.status(404).json({ error: 'Conversation not found' })
    return
  }
  res.json({ success: true })
})

// Work directories
router.get('/workdirs', (_req: Request, res: Response) => {
  res.json(getWorkDirs())
})

router.get('/directories', (req: Request, res: Response) => {
  const path = req.query.path as string
  if (!path) {
    res.status(400).json({ error: 'path query parameter is required' })
    return
  }
  res.json(getSubDirectories(path))
})

// Config
router.get('/config', (_req: Request, res: Response) => {
  res.json(getConfig())
})

router.put('/config', (req: Request, res: Response) => {
  const config = updateConfig(req.body)
  res.json(config)
})
