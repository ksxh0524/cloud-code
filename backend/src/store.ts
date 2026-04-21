import { stat, unlink, writeFile, mkdir, readdir, rename, readFile as readFileAsync } from 'fs/promises'
import { resolve, basename, join } from 'path'
import { homedir } from 'os'
import { logger } from './logger.js'

/**
 * 数据存储目录
 * 位于用户主目录下的 .cloud-code 文件夹
 */
const DATA_DIR = resolve(homedir(), '.cloud-code')

/**
 * 主数据文件路径
 * 存储会话列表和应用配置
 */
const DATA_FILE = join(DATA_DIR, 'data.json')

/**
 * 消息存储目录
 * 每个会话的消息存储在单独的 JSON 文件中
 */
const MESSAGES_DIR = join(DATA_DIR, 'messages')

/**
 * 会话接口
 * 与 frontend/src/types.ts 中的 Conversation 接口保持同步
 */
interface Conversation {
  /** 会话唯一标识符 */
  id: string
  /** 会话名称 */
  name: string
  /** 工作目录路径 */
  workDir: string
  /** CLI 类型，默认为 'claude' */
  cliType: string
  /** 创建时间 (ISO 8601 格式) */
  createdAt: string
  /** 最后更新时间 (ISO 8601 格式) */
  updatedAt: string
  /** SDK Session ID（用于恢复会话） */
  sdkSessionId?: string
}

/**
 * 应用配置接口
 */
interface AppConfig {
  /** 默认工作目录 */
  defaultWorkDir: string
}

/**
 * 存储数据结构
 */
interface StoreData {
  /** 会话列表 */
  conversations: Conversation[]
  /** 应用配置 */
  config: AppConfig
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppConfig = {
  defaultWorkDir: resolve(homedir(), 'codes'),
}

// ============================================
// 并发控制（简单的互斥锁）
// ============================================

/** 写入锁状态 */
let writeLock = false
/** 写入队列 */
let writeQueue: (() => void)[] = []

/**
 * 获取写入锁
 * @returns Promise<void>
 */
function acquireLock(): Promise<void> {
  if (!writeLock) {
    writeLock = true
    return Promise.resolve()
  }
  return new Promise<void>(resolve => writeQueue.push(resolve))
}

/**
 * 释放写入锁
 */
function releaseLock(): void {
  if (writeQueue.length > 0) {
    const next = writeQueue.shift()!
    next()
  } else {
    writeLock = false
  }
}

// ============================================
// 数据加载和保存
// ============================================

/**
 * 加载主数据文件
 * 如果文件不存在或解析失败，返回默认值
 *
 * @returns Promise<StoreData>
 */
async function loadData(): Promise<StoreData> {
  try {
    const content = await readFileAsync(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      logger.error({ err, file: DATA_FILE }, 'Failed to parse data file, resetting to defaults')
    }
  }
  return { conversations: [], config: { ...DEFAULT_CONFIG } }
}

/**
 * 保存数据到主数据文件
 * 使用临时文件和原子重命名确保数据完整性
 *
 * @param data - 要保存的数据
 * @returns Promise<void>
 */
async function saveData(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const tmpPath = DATA_FILE + '.tmp'
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmpPath, DATA_FILE)
}

/**
 * 带锁的数据操作包装器
 * 确保并发写入操作的安全
 *
 * @template T
 * @param fn - 执行数据操作的函数
 * @returns Promise<T>
 */
async function withLock<T>(fn: (store: StoreData) => { result: T; store: StoreData }): Promise<T> {
  await acquireLock()
  try {
    const { result, store } = fn(await loadData())
    await saveData(store)
    return result
  } finally {
    releaseLock()
  }
}

// ============================================
// 会话管理 (Conversations)
// ============================================

/**
 * 获取所有会话列表
 * 按更新时间降序排列
 *
 * @returns Promise<Conversation[]>
 */
export async function listConversations(): Promise<Conversation[]> {
  const data = await loadData()
  return data.conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * 根据 ID 获取单个会话
 *
 * @param id - 会话 ID
 * @returns Promise<Conversation | undefined>
 */
export async function getConversation(id: string): Promise<Conversation | undefined> {
  const data = await loadData()
  return data.conversations.find(c => c.id === id)
}

/**
 * 创建新会话
 *
 * @param data - 会话基本信息（名称和工作目录）
 * @returns Promise<Conversation>
 *
 * @example
 * ```typescript
 * const conv = await createConversation({
 *   name: 'My Project',
 *   workDir: '/home/user/projects/myapp'
 * })
 * ```
 */
export async function createConversation(data: {
  name: string
  workDir: string
}): Promise<Conversation> {
  return withLock(store => {
    const now = new Date().toISOString()
    const conv: Conversation = {
      id: crypto.randomUUID(),
      name: data.name,
      workDir: data.workDir,
      cliType: 'claude',
      createdAt: now,
      updatedAt: now,
    }
    store.conversations.push(conv)
    logger.info({ convId: conv.id, name: conv.name }, 'Conversation created')
    return { result: conv, store }
  })
}

/**
 * 更新会话信息
 *
 * @param id - 会话 ID
 * @param updates - 要更新的字段
 * @returns Promise<Conversation | null> - 更新后的会话，如果不存在则返回 null
 */
export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'name' | 'sdkSessionId'>>
): Promise<Conversation | null> {
  return withLock(store => {
    const idx = store.conversations.findIndex(c => c.id === id)
    if (idx === -1) return { result: null, store }
    store.conversations[idx] = { ...store.conversations[idx], ...updates, updatedAt: new Date().toISOString() }
    logger.info({ convId: id }, 'Conversation updated')
    return { result: store.conversations[idx], store }
  })
}

/**
 * 更新会话的最后活动时间（不修改其他字段）
 */
export async function touchConversation(id: string): Promise<void> {
  await withLock(store => {
    const idx = store.conversations.findIndex(c => c.id === id)
    if (idx !== -1) {
      store.conversations[idx].updatedAt = new Date().toISOString()
    }
    return { result: undefined, store }
  })
}

/**
 * 删除会话
 * 同时删除关联的消息记录
 *
 * @param id - 会话 ID
 * @returns Promise<boolean> - 是否成功删除
 */
export async function deleteConversation(id: string): Promise<boolean> {
  return withLock(store => {
    const before = store.conversations.length
    store.conversations = store.conversations.filter(c => c.id !== id)
    const deleted = store.conversations.length < before
    if (deleted) {
      void deleteMessages(id)
      logger.info({ convId: id }, 'Conversation deleted')
    }
    return { result: deleted, store }
  })
}

// ============================================
// 配置管理 (Config)
// ============================================

/**
 * 获取应用配置
 * 返回默认值和保存配置的合并
 *
 * @returns Promise<AppConfig>
 */
export async function getConfig(): Promise<AppConfig> {
  const data = await loadData()
  return { ...DEFAULT_CONFIG, ...data.config }
}

/**
 * 更新应用配置
 *
 * @param updates - 要更新的配置字段
 * @returns Promise<AppConfig> - 更新后的完整配置
 */
export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  return withLock(store => {
    store.config = { ...store.config, ...updates }
    logger.info('Config updated')
    return { result: store.config, store }
  })
}

// ============================================
// 工作目录管理
// ============================================

/**
 * 获取可用的工作目录列表
 * 包括默认工作目录及其子目录
 *
 * @returns Promise<{ path: string; name: string; isConfig: boolean }[]>
 */
export async function getWorkDirs(): Promise<{ path: string; name: string; isConfig: boolean }[]> {
  const config = await getConfig()
  const defaultDir = config.defaultWorkDir
  const dirs: { path: string; name: string; isConfig: boolean }[] = []

  try {
    const s = await stat(defaultDir)
      if (s.isDirectory()) {
        dirs.push({ path: defaultDir, name: basename(defaultDir), isConfig: true })
        const entries = await readdir(defaultDir, { withFileTypes: true })
        const subs = entries
          .filter(d => d.isDirectory() && !d.name.startsWith('.'))
          .map(d => ({ path: join(defaultDir, d.name), name: d.name, isConfig: false }))
        dirs.push(...subs)
      }
    } catch (err) {
      logger.debug({ err }, 'Permission error accessing defaultDir')
    }

  return dirs
}

// ============================================
// 路径安全管理
// ============================================

/**
 * 允许访问的根目录列表
 * 只允许访问这些目录下的路径
 */
const ALLOWED_ROOTS = [homedir(), resolve(homedir(), 'codes')]

/**
 * 添加允许访问的根目录
 * 用于测试或特殊配置场景
 *
 * @param root - 要添加的根目录路径
 */
export function addAllowedRoot(root: string): void {
  const r = resolve(root)
  if (!ALLOWED_ROOTS.includes(r)) ALLOWED_ROOTS.push(r)
}

/**
 * 检查路径是否允许访问
 *
 * @param dirPath - 要检查的路径
 * @returns boolean - 是否允许访问
 */
export function isPathAllowed(dirPath: string): boolean {
  const resolved = resolve(dirPath)
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + '/'))
}

/**
 * 获取指定目录的子目录列表
 * 只返回允许的目录下的结果
 *
 * @param dirPath - 目录路径
 * @returns Promise<string[]> - 子目录名称列表
 */
export async function getSubDirectories(dirPath: string): Promise<string[]> {
  const resolved = resolve(dirPath)
  if (!isPathAllowed(resolved)) return []
  try {
    const s = await stat(resolved)
    if (!s.isDirectory()) return []
    const entries = await readdir(resolved, { withFileTypes: true })
    return entries
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
  } catch (err) {
    logger.debug({ dirPath, error: String(err) }, 'Error reading subdirectories')
    return []
  }
}

// ============================================
// 消息持久化
// ============================================

/**
 * 存储消息接口
 * 与前端消息结构对应
 */
export interface StoredMessage {
  /** 消息唯一标识符 */
  id: string
  /** 消息角色：user, assistant, system */
  role: string
  /** 消息内容 */
  content: string
  /** 消息类型：text, tool_use, tool_result, thinking */
  type: string
  /** 附加元数据（如工具调用信息） */
  metadata?: Record<string, unknown>
  /** 时间戳（毫秒） */
  timestamp: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateConversationId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid conversation ID: ${id}`)
  }
}

function messageFilePath(conversationId: string): string {
  return join(MESSAGES_DIR, `${conversationId}.json`)
}

/**
 * 加载会话的消息历史
 *
 * @param conversationId - 会话 ID
 * @returns StoredMessage[] - 消息列表
 */
export async function loadMessages(conversationId: string): Promise<StoredMessage[]> {
  validateConversationId(conversationId)
  const filePath = messageFilePath(conversationId)
  try {
    const content = await readFileAsync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err: any) {
    if (err?.code === 'ENOENT') return []
    logger.error({ err, conversationId }, 'Failed to parse messages file')
    return []
  }
}

/**
 * 保存会话消息
 * 使用临时文件和原子重命名确保数据完整性
 *
 * @param conversationId - 会话 ID
 * @param messages - 要保存的消息列表
 * @returns Promise<void>
 */
export async function saveMessages(conversationId: string, messages: StoredMessage[]): Promise<void> {
  validateConversationId(conversationId)
  await mkdir(MESSAGES_DIR, { recursive: true })
  const filePath = messageFilePath(conversationId)
  const tmpPath = filePath + '.tmp'
  await writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
}

/**
 * 删除会话的消息文件
 *
 * @param conversationId - 会话 ID
 */
export async function deleteMessages(conversationId: string): Promise<void> {
  validateConversationId(conversationId)
  const filePath = messageFilePath(conversationId)
  try {
    await unlink(filePath)
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      logger.error({ err, conversationId }, 'Failed to delete messages file')
    }
  }
}
