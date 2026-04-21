import { existsSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import { homedir } from 'os'
import { query, type Query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage, HistoryMessage } from './types.js'
import { logger } from './logger.js'

interface SessionData {
  query: Query | null
  config: AgentConfig
  sdkSessionId?: string
  history: HistoryMessage[]
  abortController?: AbortController
}

const SAFE_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'TERM', 'SHELL', 'TMPDIR', 'USER']

function loadMcpConfig(): Record<string, unknown> | null {
  const mcpPath = join(homedir(), '.claude', 'mcp.json')
  if (!existsSync(mcpPath)) return null
  try {
    const data = JSON.parse(readFileSync(mcpPath, 'utf-8'))
    return data.mcpServers || null
  } catch (err) {
    logger.warn({ err, path: mcpPath }, 'Failed to load MCP config')
    return null
  }
}

const mcpServers = loadMcpConfig()
if (mcpServers) {
  logger.info({ serverNames: Object.keys(mcpServers) }, 'Loaded MCP servers from ~/.claude/mcp.json')
}

export class AgentService {
  private sessions: Map<string, SessionData> = new Map()

  async createSession(sessionId: string, config: AgentConfig): Promise<void> {
    this.sessions.set(sessionId, { query: null, config, history: [] })
  }

  updateSessionHistory(sessionId: string, history: HistoryMessage[]): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.history = history
      logger.debug({ sessionId, historyLength: history.length }, 'Session history updated')
    }
  }

  getSdkSessionId(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.sdkSessionId
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void,
    history?: HistoryMessage[]
  ): Promise<void> {
    const stored = this.sessions.get(sessionId)
    const mergedConfig = stored?.config ?? config

    const env: Record<string, string | undefined> = {}
    for (const key of SAFE_ENV_KEYS) {
      env[key] = process.env[key]
    }
    if (mergedConfig.env) {
      Object.assign(env, mergedConfig.env)
    }

    const buildPrompt = async function* () {
      // SDK resume 模式下跳过历史回放，避免消息重复
      const skipHistory = !!mergedConfig.sdkSessionId

      if (!skipHistory && history && history.length > 0) {
        for (const msg of history) {
          if (msg.role === 'user') {
            yield {
              type: 'user' as const,
              message: { role: 'user' as const, content: msg.content },
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
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content: prompt },
      } as SDKUserMessage
    }

    const options: Record<string, unknown> = {
      cwd: mergedConfig.workDir,
      env,
      allowedTools: mergedConfig.allowedTools || ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
      permissionMode: mergedConfig.permissionMode || 'acceptEdits',
      maxTurns: mergedConfig.maxTurns || 50,
      persistSession: true,
      includePartialMessages: true,
      // 加载用户本地 Claude Code 配置（模型、环境变量、权限、MCP 服务器等）
      settingSources: ['user', 'project'],
      // MCP 服务器配置
      mcpServers: mcpServers || undefined,
    }

    if (mergedConfig.sdkSessionId) {
      options.resume = mergedConfig.sdkSessionId
      logger.debug({ sessionId, sdkSessionId: mergedConfig.sdkSessionId }, 'Resuming SDK session')
    }

    const abortController = new AbortController()
    options.abortController = abortController

    logger.info({
      sessionId,
      workDir: mergedConfig.workDir,
      hasHistory: !!history && history.length > 0,
      historyLength: history?.length || 0,
      resumeSession: !!mergedConfig.sdkSessionId,
      mcpServerCount: mcpServers ? Object.keys(mcpServers).length : 0,
    }, 'Starting agent stream')

    let toolIdCounter = 0
    const pendingTools: Array<{ toolId: string; toolName: string }> = []
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
        abortController,
      })

      try {
        for await (const message of queryIterator) {
          const msgWithSession = message as Record<string, unknown>
          if (msgWithSession.session_id && typeof msgWithSession.session_id === 'string') {
            sdkSessionId = msgWithSession.session_id
            const session = this.sessions.get(sessionId)
            if (session) session.sdkSessionId = sdkSessionId
          }

          const wsMsgs = this.convertToWebSocketMessages(message, sessionId, pendingTools)
          for (const wsMsg of wsMsgs) {
            if (wsMsg.type === 'tool_call') {
              const toolId = `tool-${++toolIdCounter}`
              const toolName = String((wsMsg.data as Record<string, unknown>).toolName || '')
              ;(wsMsg.data as Record<string, unknown>).toolId = toolId
              pendingTools.push({ toolId, toolName })
            } else if (wsMsg.type === 'tool_result') {
              const pending = pendingTools.shift()
              if (pending) {
                ;(wsMsg.data as Record<string, unknown>).toolId = pending.toolId
                ;(wsMsg.data as Record<string, unknown>).toolName = pending.toolName
              }
            }
            onMessage(wsMsg)
          }
        }
      } finally {
        // 确保 query 被清理
        const current = this.sessions.get(sessionId)
        if (current?.query === queryIterator) {
          current.query = null
          current.abortController = undefined
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

  private convertToWebSocketMessages(
    message: SDKMessage,
    sessionId: string,
    pendingTools: Array<{ toolId: string; toolName: string }>,
  ): WebSocketMessage[] {
    const raw = message as Record<string, unknown>
    const msgType = raw.type as string

    if (msgType === 'system' || msgType === 'result') return []

    // Partial assistant message → token-level streaming
    if (msgType === 'assistant_partial') {
      const delta = raw.delta as Record<string, unknown> | undefined
      if (!delta) return []

      const deltaType = delta.type as string
      if (deltaType === 'text_delta') {
        return [{
          type: 'stream',
          data: { delta: { text: String(delta.text || '') } },
          sessionId,
        }]
      }
      if (deltaType === 'thinking_delta') {
        return [{
          type: 'thinking',
          data: { content: String(delta.thinking || ''), partial: true },
          sessionId,
        }]
      }
      return []
    }

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

    if (msgType === 'user') {
      const inner = raw.message as Record<string, unknown> | undefined
      if (!inner) return []
      const blocks = inner.content as Record<string, unknown>[] | undefined
      if (!Array.isArray(blocks)) return []

      const results: WebSocketMessage[] = []
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          const toolOutput = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          const pending = pendingTools.shift()
          results.push({
            type: 'tool_result',
            data: { toolName: pending?.toolName || String(block.name || ''), toolOutput },
            sessionId,
          })
        }
      }
      return results
    }

    return []
  }

  async closeSession(sessionId: string): Promise<{ sdkSessionId?: string, history: HistoryMessage[] } | null> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.abortController?.abort()
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

  interruptSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.query && typeof session.query.interrupt === 'function') {
      session.query.interrupt()
    }
    session.abortController?.abort()
  }
}

export const agentService = new AgentService()
