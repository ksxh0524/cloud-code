export interface WebSocketMessage {
  type: 'message' | 'stream' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'connected' | 'initialized'
  data: unknown
  sessionId?: string
}

export interface AgentConfig {
  workDir: string
  env?: Record<string, string>
  allowedTools?: string[]
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  maxTurns?: number
}
