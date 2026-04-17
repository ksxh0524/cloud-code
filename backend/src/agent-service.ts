import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage } from './types.js'

export class AgentService {
  private sessions: Map<string, Query | null> = new Map()

  async createSession(sessionId: string, _config: AgentConfig): Promise<void> {
    this.sessions.set(sessionId, null)
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void
  ): Promise<void> {
    const envEntries = Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
    const env: Record<string, string> = {
      ...Object.fromEntries(envEntries),
      ...config.env,
    }

    const options = {
      cwd: config.workDir,
      env,
      allowedTools: config.allowedTools || ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      permissionMode: config.permissionMode || 'acceptEdits',
      maxTurns: config.maxTurns || 50,
      persistSession: true,
      includePartialMessages: true,
    }

    try {
      const queryIterator = query({ prompt, options })
      this.sessions.set(sessionId, queryIterator)

      for await (const message of queryIterator) {
        const wsMessage = this.convertToWebSocketMessage(message, sessionId)
        onMessage(wsMessage)
      }

      onMessage({ type: 'done', data: null, sessionId })
    } catch (error) {
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
          data: {
            role: 'assistant',
            content: this.extractContent(message),
            type: 'text',
          },
          sessionId,
        }

      case 'tool_use':
        return {
          type: 'tool_call',
          data: {
            toolName: raw.tool_name,
            toolInput: raw.tool_input,
          },
          sessionId,
        }

      case 'tool_result':
        return {
          type: 'tool_result',
          data: {
            toolName: raw.tool_name,
            toolOutput: raw.tool_output,
          },
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
          data: {
            role: 'system',
            content: JSON.stringify(message),
            type: 'text',
          },
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
    const q = this.sessions.get(sessionId)
    if (q) {
      q.close?.()
      this.sessions.delete(sessionId)
    }
  }

  interruptSession(sessionId: string): void {
    const q = this.sessions.get(sessionId)
    if (q && typeof q.interrupt === 'function') {
      q.interrupt()
    }
  }
}

export const agentService = new AgentService()
