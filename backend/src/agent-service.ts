import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentConfig, WebSocketMessage } from './types.js'

export class AgentService {
  private sessions: Map<string, Query> = new Map()

  async createSession(sessionId: string, config: AgentConfig): Promise<void> {
    // 配置环境变量，支持智谱等第三方 API
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...config.env,
    }

    // 预创建一个 query 实例，但不发送消息
    // 实际使用时通过 streamMessage 发送
    this.sessions.set(sessionId, null as unknown as Query)
  }

  async streamMessage(
    sessionId: string,
    prompt: string,
    config: AgentConfig,
    onMessage: (msg: WebSocketMessage) => void
  ): Promise<void> {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...config.env,
    }

    const options = {
      cwd: config.workDir,
      env,
      allowedTools: config.allowedTools || ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      permissionMode: config.permissionMode || 'acceptEdits',
      maxTurns: config.maxTurns || 50,
      persistSession: true,
      includePartialMessages: true, // 启用流式消息
    }

    try {
      const queryIterator = query({ prompt, options })
      this.sessions.set(sessionId, queryIterator)

      for await (const message of queryIterator) {
        const wsMessage = this.convertToWebSocketMessage(message, sessionId)
        onMessage(wsMessage)
      }

      // 发送完成信号
      onMessage({
        type: 'done',
        data: null,
        sessionId,
      })
    } catch (error) {
      onMessage({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      })
    }
  }

  private convertToWebSocketMessage(message: SDKMessage, sessionId: string): WebSocketMessage {
    // 根据 SDK 消息类型转换为 WebSocket 消息
    // SDK 消息类型包括：
    // - SystemMessage
    // - AssistantMessage
    // - UserMessage
    // - StreamEvent
    // - ResultMessage

    const msgType = message.type as string

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
            toolName: (message as any).tool_name,
            toolInput: (message as any).tool_input,
          },
          sessionId,
        }

      case 'tool_result':
        return {
          type: 'tool_result',
          data: {
            toolName: (message as any).tool_name,
            toolOutput: (message as any).tool_output,
          },
          sessionId,
        }

      case 'stream_event':
        return {
          type: 'stream',
          data: {
            delta: (message as any).event?.delta,
          },
          sessionId,
        }

      case 'thinking':
        return {
          type: 'thinking',
          data: {
            content: (message as any).content,
          },
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
    // 从 SDK 消息中提取文本内容
    if (typeof message === 'object' && message !== null) {
      return (message as any).content || JSON.stringify(message)
    }
    return String(message)
  }

  async closeSession(sessionId: string): Promise<void> {
    const query = this.sessions.get(sessionId)
    if (query) {
      query.close?.()
      this.sessions.delete(sessionId)
    }
  }

  interruptSession(sessionId: string): void {
    const query = this.sessions.get(sessionId)
    if (query && typeof query.interrupt === 'function') {
      query.interrupt()
    }
  }
}

export const agentService = new AgentService()
