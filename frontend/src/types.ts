export type CliType = 'claude' | 'opencode'

export interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: CliType
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  type?: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'stream'
  toolCalls?: ToolCall[]
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
  }
  timestamp?: number
}

export interface ToolCall {
  name: string
  input?: any
  output?: any
  status: 'running' | 'completed' | 'error'
}

export interface FeishuConfig {
  appId: string
  appSecret: string
  verifyToken: string
  encryptKey: string
}

export interface AppConfig {
  feishu: FeishuConfig
  defaultWorkDir: string
}
