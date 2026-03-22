import initSqlJs, { Database } from 'sql.js'
import { join } from 'path'
import { homedir } from 'node:os'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

let dbInstance: Database | null = null
const dbDir = join(homedir(), '.cloud-code')
const dbPath = join(dbDir, 'data.db')

export async function initDb(): Promise<void> {
  // 确保目录存在
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const SQL = await initSqlJs()

  // 加载或创建数据库
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    dbInstance = new SQL.Database(buffer)
  } else {
    dbInstance = new SQL.Database()
    saveDb()
  }

  // 启用外键约束
  dbInstance.run('PRAGMA foreign_keys = ON')

  // 创建表
  createTables()

  console.log('✅ Database initialized')
}

function createTables() {
  if (!dbInstance) return

  // 会话表
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workDir TEXT NOT NULL,
      cliType TEXT DEFAULT 'claude',
      feishuChatId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `)

  // 迁移：为旧表添加 cliType 列
  try {
    dbInstance.run(`ALTER TABLE conversations ADD COLUMN cliType TEXT DEFAULT 'claude'`)
    console.log('✅ Migrated: Added cliType column to conversations')
  } catch (e) {
    // 列已存在，忽略错误
  }

  // 消息表
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      toolCalls TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)

  // 配置表
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
}

export function saveDb() {
  if (!dbInstance) return
  const data = dbInstance.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}

// 导出 getter 确保访问时 db 已初始化
export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return dbInstance
}

// 默认导出 getter
export default getDb
