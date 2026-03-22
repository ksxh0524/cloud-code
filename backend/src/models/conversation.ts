import getDb, { saveDb } from '../db/index.js'
import { Conversation, CliType } from '../../../shared/types.js'

export function createConversation(name: string, workDir: string, cliType: CliType = 'claude'): Conversation {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.run(
    'INSERT INTO conversations (id, name, workDir, cliType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, workDir, cliType, now, now]
  )
  saveDb()

  return {
    id,
    name,
    workDir,
    cliType,
    createdAt: now,
    updatedAt: now
  }
}

export function getConversation(id: string): Conversation | null {
  const db = getDb()
  const results = db.exec(`SELECT * FROM conversations WHERE id = '${id}'`)
  if (results.length === 0 || results[0].values.length === 0) return null

  const columns = results[0].columns
  const values = results[0].values[0]
  const row: any = {}
  columns.forEach((col, i) => {
    row[col] = values[i]
  })
  return row as Conversation
}

export function listConversations(): Conversation[] {
  const db = getDb()
  const results = db.exec('SELECT * FROM conversations ORDER BY updatedAt DESC')

  if (results.length === 0) return []

  const columns = results[0].columns
  return results[0].values.map(values => {
    const row: any = {}
    columns.forEach((col, i) => {
      row[col] = values[i]
    })
    return row as Conversation
  })
}

export function deleteConversation(id: string): void {
  const db = getDb()
  db.run(`DELETE FROM conversations WHERE id = '${id}'`)
  saveDb()
}

export function updateConversation(id: string, updates: Partial<Conversation>): void {
  const db = getDb()
  const fields: string[] = []
  const values: any[] = []

  if (updates.name) {
    fields.push(`name = '${updates.name}'`)
  }
  if (updates.feishuChatId !== undefined) {
    fields.push(`feishuChatId = '${updates.feishuChatId}'`)
  }

  fields.push(`updatedAt = '${new Date().toISOString()}'`)

  db.run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = '${id}'`)
  saveDb()
}
