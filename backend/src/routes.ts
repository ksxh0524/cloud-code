import { Router, type Request, type Response } from 'express'
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
} from './store.js'

export const router: Router = Router()

const createConversationSchema = z.object({
  name: z.string().min(1).max(100),
  workDir: z.string().min(1),
  cliType: z.string().default('claude'),
})

const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

const updateConfigSchema = z.object({
  defaultWorkDir: z.string().optional(),
})

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() })
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
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(conv)
})

router.patch('/conversations/:id', async (req: Request, res: Response) => {
  const parsed = updateConversationSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') }); return }
  const conv = await updateConversation(req.params.id, parsed.data)
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(conv)
})

router.delete('/conversations/:id', async (req: Request, res: Response) => {
  const ok = await deleteConversation(req.params.id)
  if (!ok) { res.status(404).json({ error: 'Conversation not found' }); return }
  logger.info({ convId: req.params.id }, 'DELETE /conversations/:id')
  res.json({ success: true })
})

router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  const conv = getConversation(req.params.id)
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(loadMessages(req.params.id))
})

router.get('/workdirs', (_req: Request, res: Response) => {
  res.json(getWorkDirs())
})

router.get('/directories', (req: Request, res: Response) => {
  const path = req.query.path as string
  if (!path) { res.status(400).json({ error: 'path query parameter is required' }); return }
  if (!isPathAllowed(path)) { res.status(403).json({ error: 'Access denied' }); return }
  res.json(getSubDirectories(path))
})

router.get('/config', (_req: Request, res: Response) => {
  res.json(getConfig())
})

router.put('/config', async (req: Request, res: Response) => {
  const parsed = updateConfigSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') }); return }
  const config = await updateConfig(parsed.data)
  res.json(config)
})
