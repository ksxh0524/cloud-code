import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { resolve, basename, join } from 'path'
import { homedir } from 'os'
import { logger } from './logger.js'

const DATA_DIR = resolve(homedir(), '.cloud-code')
const DATA_FILE = join(DATA_DIR, 'data.json')
const MESSAGES_DIR = join(DATA_DIR, 'messages')

// Keep in sync with frontend/src/types.ts Conversation interface
interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: string
  createdAt: string
  updatedAt: string
}

interface AppConfig {
  defaultWorkDir: string
}

interface StoreData {
  conversations: Conversation[]
  config: AppConfig
}

const DEFAULT_CONFIG: AppConfig = {
  defaultWorkDir: resolve(homedir(), 'codes'),
}

// Simple mutex for write operations
let writeLock = false
let writeQueue: (() => void)[] = []

function acquireLock(): Promise<void> {
  if (!writeLock) {
    writeLock = true
    return Promise.resolve()
  }
  return new Promise(resolve => writeQueue.push(resolve))
}

function releaseLock(): void {
  if (writeQueue.length > 0) {
    const next = writeQueue.shift()!
    next()
  } else {
    writeLock = false
  }
}

function loadData(): StoreData {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    } catch (err) {
      logger.error({ err, file: DATA_FILE }, 'Failed to parse data file, resetting to defaults')
    }
  }
  return { conversations: [], config: { ...DEFAULT_CONFIG } }
}

function saveData(data: StoreData): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function withLock<T>(fn: (store: StoreData) => { result: T; store: StoreData }): Promise<T> {
  await acquireLock()
  try {
    const { result, store } = fn(loadData())
    saveData(store)
    return result
  } finally {
    releaseLock()
  }
}

// Conversations
export function listConversations(): Conversation[] {
  return loadData().conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getConversation(id: string): Conversation | undefined {
  return loadData().conversations.find(c => c.id === id)
}

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

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'name'>>
): Promise<Conversation | null> {
  return withLock(store => {
    const idx = store.conversations.findIndex(c => c.id === id)
    if (idx === -1) return { result: null, store }
    store.conversations[idx] = { ...store.conversations[idx], ...updates, updatedAt: new Date().toISOString() }
    logger.info({ convId: id }, 'Conversation updated')
    return { result: store.conversations[idx], store }
  })
}

export async function deleteConversation(id: string): Promise<boolean> {
  return withLock(store => {
    const before = store.conversations.length
    store.conversations = store.conversations.filter(c => c.id !== id)
    const deleted = store.conversations.length < before
    if (deleted) {
      deleteMessages(id)
      logger.info({ convId: id }, 'Conversation deleted')
    }
    return { result: deleted, store }
  })
}

// Config
export function getConfig(): AppConfig {
  const data = loadData()
  return { ...DEFAULT_CONFIG, ...data.config }
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  return withLock(store => {
    store.config = { ...store.config, ...updates }
    logger.info('Config updated')
    return { result: store.config, store }
  })
}

// Work directories
export function getWorkDirs(): { path: string; name: string; isConfig: boolean }[] {
  const config = getConfig()
  const defaultDir = config.defaultWorkDir
  const dirs: { path: string; name: string; isConfig: boolean }[] = []

  if (existsSync(defaultDir) && statSync(defaultDir).isDirectory()) {
    dirs.push({ path: defaultDir, name: basename(defaultDir), isConfig: true })
    try {
      const subs = readdirSync(defaultDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => ({ path: join(defaultDir, d.name), name: d.name, isConfig: false }))
      dirs.push(...subs)
    } catch {
      // ignore permission errors
    }
  }

  return dirs
}

// Path safety: only allow directories under allowed roots
const ALLOWED_ROOTS = [homedir(), resolve(homedir(), 'codes')]

export function addAllowedRoot(root: string): void {
  const r = resolve(root)
  if (!ALLOWED_ROOTS.includes(r)) ALLOWED_ROOTS.push(r)
}

export function isPathAllowed(dirPath: string): boolean {
  const resolved = resolve(dirPath)
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + '/'))
}

export function getSubDirectories(dirPath: string): string[] {
  const resolved = resolve(dirPath)
  if (!isPathAllowed(resolved)) return []
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) return []
  try {
    return readdirSync(resolved, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
  } catch {
    return []
  }
}

// Message persistence (per-conversation files)
export interface StoredMessage {
  id: string
  role: string
  content: string
  type: string
  metadata?: Record<string, unknown>
  timestamp: number
}

function messageFilePath(conversationId: string): string {
  return join(MESSAGES_DIR, `${conversationId}.json`)
}

export function loadMessages(conversationId: string): StoredMessage[] {
  const filePath = messageFilePath(conversationId)
  if (!existsSync(filePath)) return []
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    logger.error({ err, conversationId }, 'Failed to parse messages file')
    return []
  }
}

export function saveMessages(conversationId: string, messages: StoredMessage[]): void {
  if (!existsSync(MESSAGES_DIR)) {
    mkdirSync(MESSAGES_DIR, { recursive: true })
  }
  writeFileSync(messageFilePath(conversationId), JSON.stringify(messages, null, 2), 'utf-8')
}

export function deleteMessages(conversationId: string): void {
  const filePath = messageFilePath(conversationId)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}
