import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage } from './types.js'
import { logger } from './logger.js'

interface SessionData {
  query: Query | null
  config: AgentConfig
}

const SAFE_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'TERM', 'SHELL', 'TMPDIR', 'USER']

export class AgentService {
  private sessions: Map<string, SessionData> = new Map()

  async createSession(sessionId: string, config: AgentConfig): Promise<void> {
    this.sessions.set(sessionId, { query: null, config })
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void
  ): Promise<void> {
    // Use stored config from init, fall back to prompt-provided config
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
      allowedTools: mergedConfig.allowedTools || ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      permissionMode: mergedConfig.permissionMode || 'acceptEdits',
      maxTurns: mergedConfig.maxTurns || 50,
      persistSession: true,
      includePartialMessages: true,
    }

    try {
      // Close any existing query iterator to prevent leaks
      const existing = this.sessions.get(sessionId)
      if (existing?.query) {
        existing.query.close?.()
      }

      const queryIterator = query({ prompt, options })
      this.sessions.set(sessionId, { query: queryIterator, config: mergedConfig })

      for await (const message of queryIterator) {
        onMessage(this.convertToWebSocketMessage(message, sessionId))
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

  private convertToWebSocketMessage(message: SDKMessage, sessionId: string): WebSocketMessage {
    const msgType = message.type as string
    const raw = message as Record<string, unknown>

    switch (msgType) {
      case 'assistant':
        return {
          type: 'message',
          data: { role: 'assistant', content: this.extractContent(message), type: 'text' },
          sessionId,
        }

      case 'tool_use':
        return {
          type: 'tool_call',
          data: { toolName: raw.tool_name, toolInput: raw.tool_input },
          sessionId,
        }

      case 'tool_result':
        return {
          type: 'tool_result',
          data: { toolName: raw.tool_name, toolOutput: raw.tool_output },
          sessionId,
        }

      case 'stream_event': {
        const delta = (raw.event as Record<string, unknown>)?.delta
        const text = typeof delta === 'string' ? delta : (delta as Record<string, unknown>)?.text || ''
        return {
          type: 'stream',
          data: { delta: { text: String(text) } },
          sessionId,
        }
      }

      case 'thinking':
        return {
          type: 'thinking',
          data: { content: String(raw.content || '') },
          sessionId,
        }

      default:
        return {
          type: 'message',
          data: { role: 'system', content: JSON.stringify(message), type: 'text' },
          sessionId,
        }
    }
  }

  private extractContent(message: SDKMessage): string {
    const raw = message as Record<string, unknown>
    const content = raw.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((block: Record<string, unknown>) => block.type === 'text')
        .map((block: Record<string, unknown>) => block.text)
        .join('')
    }
    return JSON.stringify(message)
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.query?.close?.()
      this.sessions.delete(sessionId)
      logger.info({ sessionId }, 'Session closed')
    }
  }

  interruptSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.query && typeof session.query.interrupt === 'function') {
      session.query.interrupt()
    }
  }
}

export const agentService = new AgentService()
