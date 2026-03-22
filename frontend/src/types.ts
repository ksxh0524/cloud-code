export type CliType = 'claude' | 'opencode'

export interface Conversation {
  id: string
  name: string
  workDir: string
  cliType: CliType
  feishuChatId?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  status: 'pending' | 'streaming' | 'completed' | 'error'
  createdAt: string
}

export interface ToolCall {
  name: string
  input?: any
  output?: any
  status: 'running' | 'completed' | 'error'
  startTime: string
  endTime?: string
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

export type WSEvent =
  | { type: 'connected'; conversationId: string }
  | { type: 'message'; conversationId: string; data: Partial<Message> }
  | { type: 'tool'; conversationId: string; data: ToolCall }
  | { type: 'status'; conversationId: string; data: { status: string; cliType?: string; reused?: boolean } }
  | { type: 'error'; conversationId: string; data: { error: string } }

export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done'
  content?: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
}