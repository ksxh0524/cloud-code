export interface Session {
  id: string
  workDir: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'stream'
  metadata?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolOutput?: string
  }
  timestamp: number
}

export interface WebSocketMessage {
  type: 'message' | 'stream' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done'
  data: unknown
  sessionId: string
}

export interface AgentConfig {
  workDir: string
  env?: Record<string, string>
  allowedTools?: string[]
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  maxTurns?: number
}
