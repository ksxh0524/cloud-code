import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage } from './types.js'
import { logger } from './logger.js'

/**
 * 会话数据接口
 * 存储每个 WebSocket 会话的状态
 */
interface SessionData {
  /** 当前活动的查询迭代器 */
  query: Query | null
  /** 会话配置 */
  config: AgentConfig
}

/**
 * 安全的环境变量键列表
 * 这些环境变量会被传递给 Agent
 */
const SAFE_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'TERM', 'SHELL', 'TMPDIR', 'USER']

/**
 * Agent 服务类
 *
 * 管理所有 Claude Agent 会话，处理消息流和 SDK 交互。
 * 使用单例模式，通过 `agentService` 实例访问。
 *
 * @example
 * ```typescript
 * import { agentService } from './agent-service.js'
 *
 * // 创建会话
 * await agentService.createSession('session-id', { workDir: '/tmp' })
 *
 * // 流式发送消息
 * await agentService.streamMessage(
 *   'session-id',
 *   'Hello',
 *   { workDir: '/tmp' },
 *   (msg) => console.log(msg)
 * )
 *
 * // 关闭会话
 * await agentService.closeSession('session-id')
 * ```
 */
export class AgentService {
  /** 存储所有活跃会话的 Map */
  private sessions: Map<string, SessionData> = new Map()

  /**
   * 创建新的 Agent 会话
   *
   * @param sessionId - 会话唯一标识符
   * @param config - Agent 配置
   * @returns Promise<void>
   */
  async createSession(sessionId: string, config: AgentConfig): Promise<void> {
    this.sessions.set(sessionId, { query: null, config })
  }

  /**
   * 流式发送消息到 Agent
   *
   * 使用 Claude Agent SDK 的 query 函数，支持流式响应和工具调用。
   * 消息会逐条通过 onMessage 回调返回。
   *
   * @param sessionId - 会话 ID
   * @param prompt - 用户输入的提示文本
   * @param config - Agent 配置（会与初始化时的配置合并）
   * @param onMessage - 消息回调函数，接收每条 WebSocket 消息
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await agentService.streamMessage(
   *   'session-1',
   *   'List files in current directory',
   *   { workDir: '/tmp' },
   *   (msg) => {
   *     if (msg.type === 'stream') {
   *       console.log('Stream:', msg.data.delta.text)
   *     } else if (msg.type === 'tool_call') {
   *       console.log('Tool:', msg.data.toolName)
   *     }
   *   }
   * )
   * ```
   */
  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void
  ): Promise<void> {
    const stored = this.sessions.get(sessionId)
    const mergedConfig = stored?.config ?? config

    const env: Record<string, string> = {}
    for (const key of SAFE_ENV_KEYS) {
      const val = process.env[key]
      if (val) env[key] = val
    }
    Object.assign(env, mergedConfig.env)

    const options = {
      cwd: mergedConfig.workDir,
      env,
      allowedTools: mergedConfig.allowedTools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      permissionMode: mergedConfig.permissionMode || 'acceptEdits',
      maxTurns: mergedConfig.maxTurns || 50,
      persistSession: true,
    }

    let toolIdCounter = 0
    const pendingToolIds: string[] = []

    try {
      const existing = this.sessions.get(sessionId)
      if (existing?.query) {
        await existing.query.close?.()
      }

      const queryIterator = query({ prompt, options })
      this.sessions.set(sessionId, { query: queryIterator, config: mergedConfig })

      for await (const message of queryIterator) {
        const wsMsgs = this.convertToWebSocketMessages(message, sessionId)
        for (const wsMsg of wsMsgs) {
          if (wsMsg.type === 'tool_call') {
            const toolId = `tool-${++toolIdCounter}`
            ;(wsMsg.data as Record<string, unknown>).toolId = toolId
            pendingToolIds.push(toolId)
          } else if (wsMsg.type === 'tool_result') {
            const toolId = pendingToolIds.shift()
            if (toolId) (wsMsg.data as Record<string, unknown>).toolId = toolId
          }
          onMessage(wsMsg)
        }
      }

      onMessage({ type: 'done', data: null, sessionId })
      logger.info({ sessionId }, 'Stream completed')
    } catch (error) {
      logger.error({ err: error, sessionId }, 'Stream error')
      onMessage({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      })
    }
  }

  /**
   * 将 SDK 消息转换为 WebSocket 消息数组
   *
   * SDK 消息格式（不含 includePartialMessages）:
   * - system: init 元数据 → 忽略
   * - assistant: message.content[] 包含 text/thinking/tool_use blocks
   * - user: message.content[] 包含 tool_result blocks（多轮时自动注入）
   * - result: 最终结果 → 忽略（我们自己发 done）
   */
  private convertToWebSocketMessages(message: SDKMessage, sessionId: string): WebSocketMessage[] {
    const raw = message as Record<string, unknown>
    const msgType = raw.type as string

    if (msgType === 'system' || msgType === 'result') return []

    // Assistant message → extract ALL content blocks
    if (msgType === 'assistant') {
      const inner = raw.message as Record<string, unknown> | undefined
      if (!inner) return []
      const blocks = inner.content as Record<string, unknown>[] | undefined
      if (!Array.isArray(blocks)) return []

      const results: WebSocketMessage[] = []
      for (const block of blocks) {
        const bType = block.type as string
        if (bType === 'thinking') {
          results.push({
            type: 'thinking',
            data: { content: String(block.thinking || '') },
            sessionId,
          })
        } else if (bType === 'tool_use') {
          results.push({
            type: 'tool_call',
            data: { toolName: block.name, toolInput: block.input },
            sessionId,
          })
        } else if (bType === 'text') {
          results.push({
            type: 'message',
            data: { role: 'assistant', content: String(block.text || ''), type: 'text' },
            sessionId,
          })
        }
      }
      return results
    }

    // User message (tool results from multi-turn)
    if (msgType === 'user') {
      const inner = raw.message as Record<string, unknown> | undefined
      if (!inner) return []
      const blocks = inner.content as Record<string, unknown>[] | undefined
      if (!Array.isArray(blocks)) return []

      const results: WebSocketMessage[] = []
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          const toolOutput = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          results.push({
            type: 'tool_result',
            data: { toolName: '', toolOutput },
            sessionId,
          })
        }
      }
      return results
    }

    return []
  }

  /**
   * 关闭会话
   *
   * 释放会话资源，关闭活跃的查询迭代器。
   *
   * @param sessionId - 会话 ID
   * @returns Promise<void>
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      await session.query?.close?.()
      this.sessions.delete(sessionId)
      logger.info({ sessionId }, 'Session closed')
    }
  }

  /**
   * 中断当前会话的响应
   *
   * 立即中断正在进行的 Agent 查询。
   *
   * @param sessionId - 会话 ID
   */
  interruptSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.query && typeof session.query.interrupt === 'function') {
      session.query.interrupt()
    }
  }
}

/**
 * Agent 服务单例实例
 * 全局共享的 AgentService 实例
 */
export const agentService = new AgentService()
