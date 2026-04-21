// Keep in sync with backend/src/store.ts Conversation interface
export interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: string
  createdAt: string
  updatedAt: string
  /** SDK Session ID（用于恢复会话） */
  sdkSessionId?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  type?: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  metadata?: {
    toolId?: string
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
  }
  timestamp?: number
}

/** 历史消息接口，用于多轮对话 */
export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export interface AppConfig {
  defaultWorkDir: string
}
