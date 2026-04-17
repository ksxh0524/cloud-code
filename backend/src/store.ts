import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { resolve, basename, join } from 'path'
import { homedir } from 'os'

const DATA_DIR = resolve(homedir(), '.cloud-code')
const DATA_FILE = join(DATA_DIR, 'data.json')

interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: string
  createdAt: string
  updatedAt: string
}

interface AppConfig {
  feishu: {
    appId: string
    appSecret: string
    verifyToken: string
    encryptKey: string
  }
  defaultWorkDir: string
}

interface StoreData {
  conversations: Conversation[]
  config: AppConfig
}

const DEFAULT_CONFIG: AppConfig = {
  feishu: {
    appId: '',
    appSecret: '',
    verifyToken: '',
    encryptKey: '',
  },
  defaultWorkDir: resolve(homedir(), 'codes'),
}

function loadData(): StoreData {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return { conversations: [], config: { ...DEFAULT_CONFIG } }
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

// Conversations
export function listConversations(): Conversation[] {
  return loadData().conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getConversation(id: string): Conversation | undefined {
  return loadData().conversations.find(c => c.id === id)
}

export function createConversation(data: {
  name: string
  workDir: string
  cliType: string
}): Conversation {
  const store = loadData()
  const now = new Date().toISOString()
  const conv: Conversation = {
    id: crypto.randomUUID(),
    name: data.name,
    workDir: data.workDir,
    cliType: data.cliType,
    createdAt: now,
    updatedAt: now,
  }
  store.conversations.push(conv)
  saveData(store)
  return conv
}

export function updateConversation(id: string, updates: Partial<Pick<Conversation, 'name'>>): Conversation | null {
  const store = loadData()
  const idx = store.conversations.findIndex(c => c.id === id)
  if (idx === -1) return null
  store.conversations[idx] = {
    ...store.conversations[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  saveData(store)
  return store.conversations[idx]
}

export function deleteConversation(id: string): boolean {
  const store = loadData()
  const before = store.conversations.length
  store.conversations = store.conversations.filter(c => c.id !== id)
  if (store.conversations.length === before) return false
  saveData(store)
  return true
}

// Config
export function getConfig(): AppConfig {
  const data = loadData()
  return {
    ...DEFAULT_CONFIG,
    ...data.config,
    feishu: { ...DEFAULT_CONFIG.feishu, ...data.config?.feishu },
  }
}

export function updateConfig(updates: Partial<AppConfig>): AppConfig {
  const store = loadData()
  store.config = {
    ...store.config,
    ...updates,
    feishu: { ...store.config.feishu, ...updates.feishu },
  }
  saveData(store)
  return store.config
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
        .map(d => ({
          path: join(defaultDir, d.name),
          name: d.name,
          isConfig: false,
        }))
      dirs.push(...subs)
    } catch {
      // ignore permission errors
    }
  }

  return dirs
}

export function getSubDirectories(dirPath: string): string[] {
  const resolved = resolve(dirPath)
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) return []
  try {
    return readdirSync(resolved, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
  } catch {
    return []
  }
}
