import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import type { AgentConfig, WebSocketMessage, HistoryMessage } from './types.js'
import { logger } from './logger.js'

interface SessionData {
  process: ChildProcess | null
  config: AgentConfig
  sdkSessionId?: string
  history: HistoryMessage[]
}

export class AgentService {
  private sessions: Map<string, SessionData> = new Map()
  private readonly MAX_SESSIONS = 1000
  private sessionAccessTimes: Map<string, number> = new Map()

  private enforceSessionLimit(): void {
    if (this.sessions.size < this.MAX_SESSIONS) return

    const sortedSessions = Array.from(this.sessionAccessTimes.entries())
      .sort((a, b) => a[1] - b[1])

    const sessionsToRemove = sortedSessions.slice(0, Math.ceil(this.MAX_SESSIONS * 0.1))

    for (const [sessionId] of sessionsToRemove) {
      logger.warn({ sessionId }, 'Session evicted due to limit')
      this.closeSession(sessionId).catch(err => {
        logger.error({ err, sessionId }, 'Failed to evict session')
      })
    }
  }

  private updateAccessTime(sessionId: string): void {
    this.sessionAccessTimes.set(sessionId, Date.now())
  }

  async createSession(sessionId: string, config: AgentConfig): Promise<void> {
    const existing = this.sessions.get(sessionId)
    if (existing) {
      await this.closeSession(sessionId)
    }

    this.enforceSessionLimit()

    this.sessions.set(sessionId, { process: null, config, history: [] })
    this.updateAccessTime(sessionId)
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
    _history?: HistoryMessage[],
  ): Promise<void> {
    const stored = this.sessions.get(sessionId)
    const mergedConfig = { ...(stored?.config ?? {}), ...config }

    // 构建 CLI 参数
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--include-partial-messages',
    ]

    if (mergedConfig.sdkSessionId) {
      args.push('--resume', mergedConfig.sdkSessionId)
    }
    if (mergedConfig.model) {
      args.push('--model', mergedConfig.model)
    }
    if (mergedConfig.effort) {
      args.push('--effort', mergedConfig.effort)
    }
    if (mergedConfig.permissionMode) {
      args.push('--permission-mode', mergedConfig.permissionMode)
    }
    if (mergedConfig.systemPrompt && typeof mergedConfig.systemPrompt === 'string') {
      args.push('--system-prompt', mergedConfig.systemPrompt)
    }
    if (mergedConfig.maxBudgetUsd != null) {
      args.push('--max-budget-usd', String(mergedConfig.maxBudgetUsd))
    }
    if (mergedConfig.maxTurns) {
      args.push('--max-turns', String(mergedConfig.maxTurns))
    }
    if (mergedConfig.allowedTools?.length) {
      args.push('--allowedTools', ...mergedConfig.allowedTools)
    }
    if (mergedConfig.disallowedTools?.length) {
      args.push('--disallowedTools', ...mergedConfig.disallowedTools)
    }
    if (mergedConfig.additionalDirectories?.length) {
      args.push('--add-dir', ...mergedConfig.additionalDirectories)
    }

    args.push(prompt)

    const env: Record<string, string | undefined> = { ...process.env }
    if (mergedConfig.env) {
      Object.assign(env, mergedConfig.env)
    }

    logger.info({
      sessionId,
      workDir: mergedConfig.workDir,
      resumeSession: !!mergedConfig.sdkSessionId,
      model: mergedConfig.model,
      args: args.filter(a => !a.includes('\n')).join(' ').slice(0, 200),
    }, 'Starting claude CLI')

    const proc = spawn('claude', args, {
      cwd: mergedConfig.workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // 更新 session 数据
    this.sessions.set(sessionId, {
      process: proc,
      config: mergedConfig,
      history: _history || [],
      sdkSessionId: mergedConfig.sdkSessionId,
    })
    this.updateAccessTime(sessionId)

    // 工具调用追踪
    let toolIdCounter = 0
    const pendingTools = new Map<string, { toolId: string; toolName: string }>()
    let sdkSessionId: string | undefined

    // 逐行读取 NDJSON 输出
    const rl = createInterface({ input: proc.stdout! })
    let lineCount = 0
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line) as Record<string, unknown>
        lineCount++
        const msgType = msg.type as string

        if (lineCount <= 3) {
          logger.debug({ sessionId, lineCount, msgType }, 'CLI output line')
        }

        // 捕获 session_id
        if (msg.session_id && typeof msg.session_id === 'string') {
          sdkSessionId = msg.session_id
          const session = this.sessions.get(sessionId)
          if (session) session.sdkSessionId = sdkSessionId
        }

        const wsMsgs = this.convertCliMessage(msg, sessionId)
        // 更新 toolIdCounter（convertCliMessage 内部可能递增）
        for (const wsMsg of wsMsgs) {
          if (wsMsg.type === 'tool_call') {
            const data = wsMsg.data as Record<string, unknown>
            const toolId = `tool-${++toolIdCounter}`
            const sdkToolUseId = String(data.sdkToolUseId || toolId)
            data.toolId = toolId
            pendingTools.set(sdkToolUseId, { toolId, toolName: String(data.toolName || '') })
          } else if (wsMsg.type === 'tool_result') {
            const data = wsMsg.data as Record<string, unknown>
            const sdkToolUseId = String(data.sdkToolUseId || '')
            const pending = sdkToolUseId ? pendingTools.get(sdkToolUseId) : Array.from(pendingTools.values())[0]
            if (pending) {
              pendingTools.delete(sdkToolUseId || pending.toolId)
              data.toolId = pending.toolId
            }
          }
          onMessage(wsMsg)
        }
      } catch (err) {
        logger.debug({ err, line: line.slice(0, 200) }, 'Failed to parse CLI NDJSON line')
      }
    })

    // 捕获 stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        logger.error({ sessionId, stderr: text }, 'Claude CLI stderr')
      }
    })

    // 等待进程结束
    return new Promise((resolve) => {
      proc.on('close', (code) => {
        const session = this.sessions.get(sessionId)
        if (session?.process === proc) {
          session.process = null
        }

        if (code !== 0 && code !== null) {
          logger.warn({ sessionId, exitCode: code }, 'Claude CLI exited with non-zero code')
        }

        onMessage({ type: 'done', data: { sdkSessionId }, sessionId })
        logger.info({ sessionId, sdkSessionId, exitCode: code, lineCount }, 'CLI stream completed')
        resolve()
      })

      proc.on('error', (err) => {
        logger.error({ err, sessionId }, 'Failed to spawn claude CLI')
        onMessage({
          type: 'error',
          data: { message: `Failed to start claude: ${err.message}` },
          sessionId,
        })
        onMessage({ type: 'done', data: { sdkSessionId }, sessionId })
        resolve()
      })
    })
  }

  /**
   * 将 CLI stream-json NDJSON 消息转换为 WebSocket 消息
   * CLI --output-format stream-json 输出格式:
   *   system      → init/status 元信息
   *   stream_event → Anthropic 原始 SSE 事件（text_delta, thinking_delta, tool_use 等）
   *   assistant   → 完整 assistant 消息（含 content blocks）
   *   user        → 完整 user 消息（含 tool_result）
   *   result      → 最终结果（cost, usage）
   */
  private convertCliMessage(
    msg: Record<string, unknown>,
    sessionId: string,
  ): WebSocketMessage[] {
    const msgType = msg.type as string

    // system init — 仅记录日志
    if (msgType === 'system') {
      logger.debug({
        sessionId,
        cliSessionId: msg.session_id,
        model: msg.model,
        tools: (msg.tools as string[])?.length,
        mcpServers: (msg.mcp_servers as unknown[])?.length,
      }, 'CLI session initialized')
      return []
    }

    // result — 提取 usage 和 cost
    if (msgType === 'result') {
      return [{
        type: 'usage' as const,
        data: {
          costUSD: msg.total_cost_usd,
          durationMs: msg.duration_ms,
          numTurns: msg.num_turns,
          inputTokens: (msg.usage as Record<string, unknown>)?.input_tokens,
          outputTokens: (msg.usage as Record<string, unknown>)?.output_tokens,
        },
        sessionId,
      }]
    }

    // stream_event → Anthropic 原始 SSE 事件，需要解包
    if (msgType === 'stream_event') {
      const event = msg.event as Record<string, unknown> | undefined
      if (!event) return []

      const eventType = event.type as string
      const delta = event.delta as Record<string, unknown> | undefined

      if (eventType === 'content_block_delta' && delta) {
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
        // tool_use 的 input_json_delta — 暂不处理，等完整 tool_use 消息
      }

      // message_delta 中有 usage 信息
      if (eventType === 'message_delta' && delta) {
        const usage = event.usage as Record<string, unknown> | undefined
        if (usage) {
          return [{
            type: 'usage' as const,
            data: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
            },
            sessionId,
          }]
        }
      }

      return []
    }

    // assistant 完整消息
    if (msgType === 'assistant') {
      const inner = msg.message as Record<string, unknown> | undefined
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
            data: {
              toolName: block.name,
              toolInput: block.input,
              sdkToolUseId: String(block.id || ''),
            },
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

    // user 消息（工具结果）
    if (msgType === 'user') {
      const inner = msg.message as Record<string, unknown> | undefined
      if (!inner) return []
      const blocks = inner.content as Record<string, unknown>[] | undefined
      if (!Array.isArray(blocks)) return []

      const results: WebSocketMessage[] = []
      for (const block of blocks) {
        if (block.type === 'tool_result') {
          const toolOutput = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content)
          results.push({
            type: 'tool_result',
            data: {
              toolName: String(block.name || ''),
              toolOutput,
              sdkToolUseId: String(block.tool_use_id || ''),
            },
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
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM')
      }
      const result = {
        sdkSessionId: session.sdkSessionId,
        history: session.history,
      }
      this.sessions.delete(sessionId)
      this.sessionAccessTimes.delete(sessionId)
      logger.info({ sessionId, sdkSessionId: result.sdkSessionId }, 'Session closed')
      return result
    }
    return null
  }

  interruptSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.process && !session.process.killed) {
      // 先发 SIGINT 让 CLI 优雅中断
      session.process.kill('SIGINT')
      // 如果 3 秒后还没退出，强杀
      const proc = session.process
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL')
        }
      }, 3000)
    }
  }
}

export const agentService = new AgentService()
