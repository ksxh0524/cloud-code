import { query, type Query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage, HistoryMessage } from './types.js'
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
  /** SDK Session ID（用于恢复） */
  sdkSessionId?: string
  /** 会话历史消息 */
  history: HistoryMessage[]
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
 *   'session-1',
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
    this.sessions.set(sessionId, { query: null, config, history: [] })
  }

  /**
   * 更新会话历史消息
   *
   * @param sessionId - 会话 ID
   * @param history - 历史消息列表
   */
  updateSessionHistory(sessionId: string, history: HistoryMessage[]): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.history = history
      logger.debug({ sessionId, historyLength: history.length }, 'Session history updated')
    }
  }

  /**
   * 获取会话的 SDK Session ID
   *
   * @param sessionId - 会话 ID
   * @returns SDK Session ID 或 undefined
   */
  getSdkSessionId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.sdkSessionId
  }

  /**
   * 流式发送消息到 Agent
   *
   * 使用 Claude Agent SDK 的 query 函数，支持流式响应和工具调用。
   * 消息会逐条通过 onMessage 回调返回。
   * 支持多轮对话：自动传递历史消息作为上下文，并使用 SDK 的 session 恢复功能。
   *
   * @param sessionId - 会话 ID
   * @param prompt - 用户输入的提示文本
   * @param config - Agent 配置（会与初始化时的配置合并）
   * @param onMessage - 消息回调函数，接收每条 WebSocket 消息
   * @param history - 可选的历史消息列表，用于多轮对话上下文
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await agentService.streamMessage(
   *   'session-1',
   *   'List files in current directory',
   *   { workDir: '/tmp' },
   *   (msg) => console.log(msg),
   *   [{ role: 'user', content: 'Previous message' }, { role: 'assistant', content: 'Previous response' }]
   * )
   * ```
   */
  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void,
    history?: HistoryMessage[]
  ): Promise<void> {
    const stored = this.sessions.get(sessionId)
    const mergedConfig = stored?.config ?? config

    const env: Record<string, string> = {}
    for (const key of SAFE_ENV_KEYS) {
      const val = process.env[key]
      if (val) env[key] = val
    }
    Object.assign(env, mergedConfig.env)

    // 构建 prompt：如果有历史消息，格式化为多轮对话
    // 构建 prompt：如果有历史消息，格式化为多轮对话
    // 注意：prompt 可以是 string 或 AsyncIterable<SDKUserMessage>
    // 我们使用 generator function 来创建 AsyncIterable
    const buildPrompt = async function* () {
      if (history && history.length > 0) {
        // 先发送历史消息
        for (const msg of history) {
          if (msg.role === 'user') {
            yield {
              type: 'user' as const,
              message: {
                role: 'user' as const,
                content: msg.content,
              },
            } as SDKUserMessage
          } else if (msg.role === 'assistant') {
            yield {
              type: 'user' as const,
              message: {
                role: 'assistant' as const,
                content: [{ type: 'text' as const, text: msg.content }],
              },
            } as unknown as SDKUserMessage
          }
        }
      }
      // 最后发送当前消息
      yield {
        type: 'user' as const,
        message: {
          role: 'user' as const,
          content: prompt,
        },
      } as SDKUserMessage
    }

    // 构建选项：使用 resume 或 sessionId 来保持会话连续性
    const options: Record<string, unknown> = {
      cwd: mergedConfig.workDir,
      env,
      allowedTools: mergedConfig.allowedTools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      permissionMode: mergedConfig.permissionMode || 'acceptEdits',
      maxTurns: mergedConfig.maxTurns || 50,
      persistSession: true,
      // 启用调试输出
      debug: process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug',
      // stderr 回调用于捕获 SDK 调试日志
      stderr: (data: string) => {
        logger.debug({ sessionId, sdkData: data.trim() }, 'SDK stderr')
      },
    }

    // 如果有 SDK Session ID，使用 resume 来恢复会话
    if (mergedConfig.sdkSessionId) {
      options.resume = mergedConfig.sdkSessionId
      logger.debug({ sessionId, sdkSessionId: mergedConfig.sdkSessionId }, 'Resuming SDK session')
    }

    logger.info({
      sessionId,
      workDir: mergedConfig.workDir,
      hasHistory: !!history && history.length > 0,
      historyLength: history?.length || 0,
      resumeSession: !!mergedConfig.sdkSessionId,
    }, 'Starting agent stream')

    let toolIdCounter = 0
    const pendingToolIds: string[] = []
    let sdkSessionId: string | undefined

    try {
      const existing = this.sessions.get(sessionId)
      if (existing?.query) {
        await existing.query.close?.()
      }

      const queryIterator = query({ prompt: buildPrompt(), options })
      this.sessions.set(sessionId, {
        query: queryIterator,
        config: mergedConfig,
        history: history || [],
        sdkSessionId: mergedConfig.sdkSessionId,
      })

      for await (const message of queryIterator) {
        // 捕获 SDK Session ID
        const msgWithSession = message as Record<string, unknown>
        if (msgWithSession.session_id && typeof msgWithSession.session_id === 'string') {
          sdkSessionId = msgWithSession.session_id
          // 更新会话中的 SDK Session ID
          const session = this.sessions.get(sessionId)
          if (session) {
            session.sdkSessionId = sdkSessionId
          }
        }

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

      onMessage({ type: 'done', data: { sdkSessionId }, sessionId })
      logger.info({ sessionId, sdkSessionId }, 'Stream completed')
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
   * 保留 SDK Session ID 以便后续恢复。
   *
   * @param sessionId - 会话 ID
   * @returns Promise<{ sdkSessionId?: string, history: HistoryMessage[] } | null>
   */
  async closeSession(sessionId: string): Promise<{ sdkSessionId?: string, history: HistoryMessage[] } | null> {
    const session = this.sessions.get(sessionId)
    if (session) {
      await session.query?.close?.()
      const result = {
        sdkSessionId: session.sdkSessionId,
        history: session.history,
      }
      this.sessions.delete(sessionId)
      logger.info({ sessionId, sdkSessionId: result.sdkSessionId }, 'Session closed')
      return result
    }
    return null
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
