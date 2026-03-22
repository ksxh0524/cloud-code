import { spawn } from 'child_process'
import { wsManager } from './ws-manager.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Session {
  process: any
  workDir: string
  conversationId: string
}

export class ClaudeService {
  private sessions: Map<string, Session> = new Map()

  async startSession(conversationId: string, workDir: string): Promise<void> {
    if (this.sessions.has(conversationId)) {
      // 如果会话已存在，先停止它再重新启动
      this.stopSession(conversationId)
    }

    console.log(`[Claude] Starting session ${conversationId} in ${workDir}`)

    // 使用 Python PTY wrapper 启动 claude
    // tsx 运行时 __dirname 指向源文件位置: backend/src/services
    // 需要往上3级到项目根目录: backend/src/services -> backend/src -> backend -> 项目根
    const wrapperPath = join(__dirname, '../../../scripts/pty-wrapper.py')
    console.log(`[Claude] Wrapper path: ${wrapperPath}`)
    const pty = spawn('python3', [wrapperPath, workDir], {
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
      conversationId
    }

    this.sessions.set(conversationId, session)

    // 处理输出
    pty.stdout?.on('data', (data: Buffer) => {
      const output = data.toString('utf-8')
      console.log(`[Claude output ${conversationId}]`, output.substring(0, 100))

      wsManager.broadcast(conversationId, {
        type: 'output',
        conversationId,
        data: { output }
      })
    })

    pty.stderr?.on('data', (data: Buffer) => {
      const error = data.toString('utf-8')
      // 忽略 ready 消息，不发送到前端
      if (error.includes('"type": "ready"')) {
        console.log(`[Claude] Session ${conversationId} ready`)
        return
      }
      console.error(`[Claude stderr ${conversationId}]`, error.substring(0, 100))
    })

    pty.on('close', (code: number) => {
      console.log(`[Claude] Session ${conversationId} exited with code ${code}`)
      this.sessions.delete(conversationId)

      wsManager.broadcast(conversationId, {
        type: 'output',
        conversationId,
        data: { output: '\r\n[Process exited]\r\n' }
      })
    })

    pty.on('error', (err: Error) => {
      console.error(`[Claude] Session ${conversationId} error:`, err)
    })
  }

  async sendInput(conversationId: string, input: string): Promise<void> {
    const session = this.sessions.get(conversationId)
    if (!session) {
      // 会话不存在时静默返回，不抛出错误
      console.log(`[Claude] Session ${conversationId} not found, ignoring input`)
      return
    }

    console.log(`[Claude] Sending input to ${conversationId}:`, input.substring(0, 50))
    // 直接发送输入，不添加额外的换行符
    session.process.stdin?.write(input)
  }

  async stopSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId)
    if (!session) {
      return
    }

    // Ctrl+D 退出
    session.process.stdin?.write('\x04')

    setTimeout(() => {
      session.process.kill('SIGTERM')
    }, 2000)

    this.sessions.delete(conversationId)
  }

  hasSession(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }

  getSessionList(): string[] {
    return Array.from(this.sessions.keys())
  }
}

export const claudeService = new ClaudeService()
