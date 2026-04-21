// Keep in sync with backend/src/store.ts Conversation interface
export interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  type?: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
  }
  timestamp?: number
}

export interface ToolCall {
  name: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  status: 'running' | 'completed' | 'error'
}

export interface AppConfig {
  defaultWorkDir: string
}
