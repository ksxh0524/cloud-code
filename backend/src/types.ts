import { z } from 'zod'

export const WS_PROTOCOL_VERSION = 1

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface WebSocketMessage {
  type: 'message' | 'stream' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'connected' | 'initialized' | 'usage'
  data: Record<string, unknown> | null
  sessionId?: string
}

export interface AgentConfig {
  workDir: string
  env?: Record<string, string>
  allowedTools?: string[]
  disallowedTools?: string[]
  permissionMode?: PermissionMode
  maxTurns?: number
  sdkSessionId?: string
  model?: string
  effort?: EffortLevel
  systemPrompt?: string
  maxBudgetUsd?: number
  additionalDirectories?: string[]
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

// ============================================
// WebSocket 消息验证 Schemas (Zod)
// ============================================

const agentConfigPartial = z.object({
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  systemPrompt: z.string().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk', 'auto']).optional(),
  maxTurns: z.number().int().positive().optional(),
  additionalDirectories: z.array(z.string()).optional(),
})

export const wsInitSchema = z.object({
  type: z.literal('init'),
  data: z.object({
    workDir: z.string().refine(
      (val) => !val || val.startsWith('/'),
      { message: 'workDir must be an absolute path if provided' }
    ).optional(),
    apiKey: z.string().optional(),
  }).merge(agentConfigPartial),
})

export const wsPromptSchema = z.object({
  type: z.literal('prompt'),
  data: z.object({
    prompt: z.string().min(1),
    workDir: z.string().min(1).refine(
      (val) => val.startsWith('/'),
      { message: 'workDir must be an absolute path' }
    ),
    conversationId: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.number().optional(),
    })).optional(),
    sdkSessionId: z.string().nullable().optional(),
  }).merge(agentConfigPartial),
})

export const wsInterruptSchema = z.object({
  type: z.literal('interrupt'),
})

export const wsCloseSchema = z.object({
  type: z.literal('close'),
})

export const wsMessageSchema = z.discriminatedUnion('type', [
  wsInitSchema, wsPromptSchema, wsInterruptSchema, wsCloseSchema,
])

export type WsInitMessage = z.infer<typeof wsInitSchema>
export type WsPromptMessage = z.infer<typeof wsPromptSchema>
export type WsInterruptMessage = z.infer<typeof wsInterruptSchema>
export type WsCloseMessage = z.infer<typeof wsCloseSchema>
export type WsMessage = z.infer<typeof wsMessageSchema>
