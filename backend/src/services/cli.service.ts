import { spawn } from 'child_process'
import { wsManager } from './ws-manager.js'
import { CliType } from '../../../shared/types.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Session {
  process: any
  workDir: string
  conversationId: string
  cliType: CliType
}

export class CliService {
  private sessions: Map<string, Session> = new Map()

  async startSession(conversationId: string, workDir: string, cliType: CliType): Promise<void> {
    // 检查会话是否已存在且进程还在运行
    const existingSession = this.sessions.get(conversationId)
    if (existingSession && existingSession.process.poll() === null) {
      console.log(`[CLI:${cliType}] Session ${conversationId} already running, reusing`)
      // 发送状态更新
      wsManager.broadcast(conversationId, {
        type: 'status',
        conversationId,
        data: { status: 'started', cliType, reused: true }
      })
      return
    }

    // 如果会话存在但进程已退出，清理它
    if (existingSession) {
      this.sessions.delete(conversationId)
    }

    console.log(`[CLI:${cliType}] Starting session ${conversationId} in ${workDir}`)

    // 使用 Python PTY wrapper 启动 CLI
    // wrapper 路径: backend/src/services -> backend -> 项目根 -> scripts
    const wrapperPath = join(__dirname, '../../../scripts/pty-wrapper.py')
    console.log(`[CLI:${cliType}] Wrapper path: ${wrapperPath}`)
    
    const pty = spawn('python3', [wrapperPath, workDir, cliType], {
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const session: Session = {
      process: pty,
      workDir,
      conversationId,
      cliType
    }

    this.sessions.set(conversationId, session)

    // 处理输出
    pty.stdout?.on('data', (data: Buffer) => {
      const output = data.toString('utf-8')
      console.log(`[CLI:${cliType} stdout ${conversationId}]`, output.substring(0, 200))

      wsManager.broadcast(conversationId, {
        type: 'output',
        conversationId,
        data: { output }
      })
    })

    pty.stderr?.on('data', (data: Buffer) => {
      const error = data.toString('utf-8')
      
      // 忽略 ready 消息，不发送到前端
      if (error.includes('"type": "ready"') || error.includes('"type":"ready"')) {
        console.log(`[CLI:${cliType}] Session ${conversationId} ready`)
        return
      }
      
      console.error(`[CLI:${cliType} stderr ${conversationId}]`, error.substring(0, 200))
    })

    pty.on('close', (code: number) => {
      console.log(`[CLI:${cliType}] Session ${conversationId} exited with code ${code}`)
      this.sessions.delete(conversationId)

      wsManager.broadcast(conversationId, {
        type: 'output',
        conversationId,
        data: { output: `\r\n[${cliType} process exited with code ${code}]\r\n` }
      })
    })

    pty.on('error', (err: Error) => {
      console.error(`[CLI:${cliType}] Session ${conversationId} error:`, err)
      
      // 发送错误信息到前端
      wsManager.broadcast(conversationId, {
        type: 'output',
        conversationId,
        data: { output: `\r\n[Error: Failed to start ${cliType}: ${err.message}]\r\n` }
      })
      
      this.sessions.delete(conversationId)
    })

    // 发送启动成功消息
    wsManager.broadcast(conversationId, {
      type: 'status',
      conversationId,
      data: { status: 'started', cliType }
    })
  }

  async sendInput(conversationId: string, input: string): Promise<void> {
    const session = this.sessions.get(conversationId)
    if (!session) {
      console.log(`[CLI] Session ${conversationId} not found, ignoring input`)
      return
    }

    console.log(`[CLI:${session.cliType}] Sending input to ${conversationId}:`, input.substring(0, 50))
    // 直接发送输入，不添加额外的换行符
    session.process.stdin?.write(input)
  }

  async stopSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId)
    if (!session) {
      return
    }

    const { cliType, process: proc } = session

    console.log(`[CLI:${cliType}] Stopping session ${conversationId}`)

    // 发送 Ctrl+D 退出
    proc.stdin?.write('\x04')

    // 超时后强制终止
    setTimeout(() => {
      proc.kill('SIGTERM')
    }, 2000)

    this.sessions.delete(conversationId)
  }

  hasSession(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }

  getSession(conversationId: string): Session | undefined {
    return this.sessions.get(conversationId)
  }

  getSessionList(): Array<{ id: string; cliType: CliType }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      cliType: session.cliType
    }))
  }

  // 获取支持的 CLI 类型列表
  getSupportedCliTypes(): Array<{ type: CliType; name: string; description: string }> {
    return [
      {
        type: 'claude',
        name: 'Claude Code',
        description: 'Anthropic Claude Code CLI - AI 编程助手'
      },
      {
        type: 'opencode',
        name: 'OpenCode',
        description: 'OpenCode CLI - 开源 AI 编程助手'
      }
    ]
  }

  // 检查 CLI 是否已安装
  async checkCliInstalled(cliType: CliType): Promise<{ installed: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(cliType, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8')
      })

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8')
      })

      proc.on('close', (code: number) => {
        if (code === 0) {
          const version = stdout.trim() || stderr.trim()
          resolve({ installed: true, version })
        } else {
          resolve({ installed: false, error: stderr.trim() || `${cliType} not found` })
        }
      })

      proc.on('error', (err: Error) => {
        resolve({ installed: false, error: err.message })
      })

      // 超时处理
      setTimeout(() => {
        proc.kill()
        resolve({ installed: false, error: 'Timeout checking version' })
      }, 5000)
    })
  }
}

export const cliService = new CliService()
