import { Router, type Request, type Response, type NextFunction } from 'express'
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

/**
 * Express 路由实例
 * 定义所有 REST API 端点
 */
export const router: Router = Router()

/**
 * 异步路由处理器包装器
 * 自动捕获异步函数中的错误并传递给 Express 错误处理中间件
 *
 * @param fn - 异步路由处理函数
 * @returns 包装后的路由处理函数
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next)

// ============================================
// Zod 验证 Schemas
// ============================================

/**
 * 创建会话请求体验证 Schema
 */
const createConversationSchema = z.object({
  /** 会话名称，1-100 字符 */
  name: z.string().min(1).max(100),
  /** 工作目录路径（必须是绝对路径且在允许的根目录下） */
  workDir: z.string().min(1).refine(
    (val) => val.startsWith('/') && isPathAllowed(val),
    { message: 'workDir must be an absolute path within allowed directories' }
  ),
  /** CLI 类型，默认为 'claude' */
  cliType: z.string().default('claude'),
})

/**
 * 更新会话请求体验证 Schema
 */
const updateConversationSchema = z.object({
  /** 会话名称，1-100 字符（可选） */
  name: z.string().min(1).max(100).optional(),
  /** SDK Session ID（可选） */
  sdkSessionId: z.string().optional(),
})

/**
 * 更新配置请求体验证 Schema
 */
const updateConfigSchema = z.object({
  /** 默认工作目录路径（可选，必须是绝对路径且在允许的根目录下） */
  defaultWorkDir: z.string().optional().refine(
    (val) => !val || (val.startsWith('/') && isPathAllowed(val)),
    { message: 'defaultWorkDir must be an absolute path within allowed directories' }
  ),
})

// ============================================
// 健康检查
// ============================================

/**
 * GET /api/health
 * 健康检查端点
 *
 * @returns { status: 'ok', timestamp: number }
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// ============================================
// 会话管理 (Conversations)
// ============================================

/**
 * GET /api/conversations
 * 获取所有会话列表
 *
 * 按更新时间降序排列
 *
 * @returns Conversation[] - 会话列表
 */
router.get('/conversations', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await listConversations())
}))

/**
 * POST /api/conversations
 * 创建新会话
 *
 * @body { name: string, workDir: string, cliType?: string }
 * @returns Conversation - 创建的会话对象
 * @status 201 - 创建成功
 * @status 400 - 请求参数无效
 */
router.post('/conversations', asyncHandler(async (req: Request, res: Response) => {
  const parsed = createConversationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') })
    return
  }
  const conv = await createConversation(parsed.data)
  logger.info({ convId: conv.id }, 'POST /conversations')
  res.status(201).json(conv)
}))

/**
 * GET /api/conversations/:id
 * 获取单个会话详情
 *
 * @param id - 会话 ID
 * @returns Conversation - 会话对象
 * @status 200 - 成功
 * @status 404 - 会话不存在
 */
router.get('/conversations/:id', asyncHandler(async (req: Request, res: Response) => {
  const conv = await getConversation(req.params.id)
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(conv)
}))

/**
 * PATCH /api/conversations/:id
 * 更新会话信息
 *
 * @param id - 会话 ID
 * @body { name?: string }
 * @returns Conversation - 更新后的会话对象
 * @status 200 - 成功
 * @status 400 - 请求参数无效
 * @status 404 - 会话不存在
 */
router.patch('/conversations/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateConversationSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') }); return }
  const conv = await updateConversation(req.params.id, parsed.data)
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(conv)
}))

/**
 * DELETE /api/conversations/:id
 * 删除会话
 *
 * 同时删除关联的消息记录
 *
 * @param id - 会话 ID
 * @returns { success: true }
 * @status 200 - 成功
 * @status 404 - 会话不存在
 */
router.delete('/conversations/:id', asyncHandler(async (req: Request, res: Response) => {
  const ok = await deleteConversation(req.params.id)
  if (!ok) { res.status(404).json({ error: 'Conversation not found' }); return }
  logger.info({ convId: req.params.id }, 'DELETE /conversations/:id')
  res.json({ success: true })
}))

/**
 * GET /api/conversations/:id/messages
 * 获取会话的消息历史
 *
 * @param id - 会话 ID
 * @returns StoredMessage[] - 消息列表
 * @status 200 - 成功
 * @status 404 - 会话不存在
 */
router.get('/conversations/:id/messages', asyncHandler(async (req: Request, res: Response) => {
  const conv = await getConversation(req.params.id)
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  res.json(await loadMessages(req.params.id))
}))

// ============================================
// 工作目录
// ============================================

/**
 * GET /api/workdirs
 * 获取可用的工作目录列表
 *
 * 包括默认工作目录及其子目录
 *
 * @returns { path: string, name: string, isConfig: boolean }[]
 */
router.get('/workdirs', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getWorkDirs())
}))

/**
 * GET /api/directories
 * 获取指定目录的子目录列表
 *
 * @query path - 目录路径
 * @returns string[] - 子目录名称列表
 * @status 200 - 成功
 * @status 400 - 缺少 path 参数
 * @status 403 - 路径不允许访问
 */
router.get('/directories', asyncHandler(async (req: Request, res: Response) => {
  const path = req.query.path as string
  if (!path) { res.status(400).json({ error: 'path query parameter is required' }); return }
  if (!isPathAllowed(path)) { res.status(403).json({ error: 'Access denied' }); return }
  res.json(await getSubDirectories(path))
}))

// ============================================
// 配置管理
// ============================================

/**
 * GET /api/config
 * 获取应用配置
 *
 * @returns { defaultWorkDir: string }
 */
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getConfig())
}))

/**
 * PUT /api/config
 * 更新应用配置
 *
 * @body { defaultWorkDir?: string }
 * @returns { defaultWorkDir: string } - 更新后的配置
 * @status 200 - 成功
 * @status 400 - 请求参数无效
 */
router.put('/config', asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateConfigSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') }); return }
  const config = await updateConfig(parsed.data)
  res.json(config)
}))

router.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})
