import getDb, { saveDb } from '../db/index.js'
import { Message, ToolCall } from '../../../shared/types.js'

export function createMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: ToolCall[]
): Message {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO messages (id, conversationId, role, content, toolCalls, status, createdAt) VALUES ('${id}', '${conversationId}', '${role}', '${content.replace(/'/g, "''")}', '${toolCalls ? JSON.stringify(toolCalls).replace(/'/g, "''") : 'null'}', 'completed', '${now}')`
  )
  saveDb()

  return {
    id,
    conversationId,
    role,
    content,
    toolCalls,
    status: 'completed',
    createdAt: now
  }
}

export function getMessages(conversationId: string): Message[] {
  const db = getDb()
  const results = db.exec(`SELECT * FROM messages WHERE conversationId = '${conversationId}' ORDER BY createdAt ASC`)

  if (results.length === 0) return []

  const columns = results[0].columns
  return results[0].values.map(values => {
    const row: any = {}
    columns.forEach((col, i) => {
      row[col] = values[i]
    })
    if (row.toolCalls) {
      try {
        row.toolCalls = JSON.parse(row.toolCalls)
      } catch {
        row.toolCalls = undefined
      }
    }
    return row as Message
  })
}

export function updateMessage(id: string, updates: Partial<Message>): void {
  const db = getDb()
  const fields: string[] = []

  if (updates.content !== undefined) {
    fields.push(`content = '${updates.content.replace(/'/g, "''")}'`)
  }
  if (updates.toolCalls !== undefined) {
    fields.push(`toolCalls = '${JSON.stringify(updates.toolCalls).replace(/'/g, "''")}'`)
  }
  if (updates.status) {
    fields.push(`status = '${updates.status}'`)
  }

  db.run(`UPDATE messages SET ${fields.join(', ')} WHERE id = '${id}'`)
  saveDb()
}
