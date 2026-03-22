// 共享类型定义

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

// WebSocket 事件类型
export type WSEvent =
  | { type: 'message'; conversationId: string; data: Message }
  | { type: 'tool'; conversationId: string; data: ToolCall }
  | { type: 'status'; conversationId: string; data: { status: string } }
  | { type: 'error'; conversationId: string; data: { error: string } }

// CLI 流式输出事件
export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done'
  content?: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
}
