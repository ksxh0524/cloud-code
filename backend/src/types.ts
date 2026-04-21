import { z } from 'zod'

/**
 * WebSocket 消息类型定义
 * 用于前后端通信的消息格式
 */
export interface WebSocketMessage {
  /** 消息类型 */
  type: 'message' | 'stream' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done' | 'connected' | 'initialized'
  /** 消息数据内容 */
  data: unknown
  /** 会话 ID（可选） */
  sessionId?: string
}

/**
 * Agent 配置接口
 * 定义了 Agent 会话的配置选项
 */
export interface AgentConfig {
  /** 工作目录路径 */
  workDir: string
  /** 环境变量（可选） */
  env?: Record<string, string>
  /** 允许使用的工具列表（可选） */
  allowedTools?: string[]
  /** 权限模式（可选） */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  /** 最大对话轮数（可选） */
  maxTurns?: number
}

// ============================================
// WebSocket 消息验证 Schemas (Zod)
// ============================================

/**
 * WebSocket 初始化消息 Schema
 * 客户端连接后发送的第一条消息
 * @example
 * { type: 'init', data: { workDir: '/path/to/project' } }
 */
export const wsInitSchema = z.object({
  type: z.literal('init'),
  data: z.object({
    /** 工作目录路径，必须非空 */
    workDir: z.string().min(1),
    /** API 密钥（可选，用于认证） */
    apiKey: z.string().optional(),
  }),
})

/**
 * WebSocket 提示消息 Schema
 * 用户发送的消息
 * @example
 * { type: 'prompt', data: { prompt: 'Hello', workDir: '/path', conversationId: 'xxx' } }
 */
export const wsPromptSchema = z.object({
  type: z.literal('prompt'),
  data: z.object({
    /** 用户输入的提示文本，必须非空 */
    prompt: z.string().min(1),
    /** 工作目录路径，必须非空 */
    workDir: z.string().min(1),
    /** 关联的会话 ID（可选） */
    conversationId: z.string().optional(),
  }),
})

/**
 * WebSocket 中断消息 Schema
 * 用于中断当前的 Agent 响应
 * @example
 * { type: 'interrupt' }
 */
export const wsInterruptSchema = z.object({
  type: z.literal('interrupt'),
})

/**
 * WebSocket 关闭消息 Schema
 * 用于优雅地关闭会话
 * @example
 * { type: 'close' }
 */
export const wsCloseSchema = z.object({
  type: z.literal('close'),
})

/**
 * WebSocket 消息联合 Schema
 * 所有可能的 WebSocket 消息类型的联合
 */
export const wsMessageSchema = z.discriminatedUnion('type', [
  wsInitSchema, wsPromptSchema, wsInterruptSchema, wsCloseSchema,
])

/** WebSocket 初始化消息类型 */
export type WsInitMessage = z.infer<typeof wsInitSchema>
/** WebSocket 提示消息类型 */
export type WsPromptMessage = z.infer<typeof wsPromptSchema>
/** WebSocket 中断消息类型 */
export type WsInterruptMessage = z.infer<typeof wsInterruptSchema>
/** WebSocket 关闭消息类型 */
export type WsCloseMessage = z.infer<typeof wsCloseSchema>
/** 所有 WebSocket 消息类型的联合 */
export type WsMessage = z.infer<typeof wsMessageSchema>
