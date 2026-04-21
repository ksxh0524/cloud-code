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

// ============================================
// WebSocket 消息类型系统
// ============================================

export type WsServerMessage =
  | { type: 'connected'; data: { sessionId: string }; sessionId?: string }
  | { type: 'initialized'; data: { sessionId: string }; sessionId?: string }
  | { type: 'message'; data: { role: string; content: string; type: string }; sessionId?: string }
  | { type: 'stream'; data: { delta: { text: string } }; sessionId?: string }
  | { type: 'thinking'; data: { content: string; partial?: boolean }; sessionId?: string }
  | { type: 'tool_call'; data: { toolId?: string; toolName: string; toolInput: Record<string, unknown> }; sessionId?: string }
  | { type: 'tool_result'; data: { toolId?: string; toolName?: string; toolOutput: string }; sessionId?: string }
  | { type: 'done'; data: { sdkSessionId?: string } | null; sessionId?: string }
  | { type: 'error'; data: string; sessionId?: string }
