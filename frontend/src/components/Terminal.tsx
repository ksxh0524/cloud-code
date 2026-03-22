import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  conversationId: string
}

interface TerminalState {
  connected: boolean
  connecting: boolean
  cliReady: boolean
  error: string | null
}

export default function Terminal({ conversationId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const isManualCloseRef = useRef(false)

  const [state, setState] = useState<TerminalState>({
    connected: false,
    connecting: false,
    cliReady: false,
    error: null
  })

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return

    // 创建终端实例 - 修复字符间距问题
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'underline',  // 使用下划线光标避免显示为问号
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.2,
      theme: {
        background: '#1a1a1a',  // 深色背景更适合 TUI
        foreground: '#e5e5e5',
        cursor: '#10a37f',  // 绿色光标更醒目
        cursorAccent: '#1a1a1a',
        selectionBackground: '#3b82f640',
        black: '#1a1a1a',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#4dabf7',
        magenta: '#da77f2',
        cyan: '#3bc9db',
        white: '#e5e5e5',
        brightBlack: '#495057',
        brightRed: '#ff8787',
        brightGreen: '#69db7c',
        brightYellow: '#fcc419',
        brightBlue: '#74c0fc',
        brightMagenta: '#e599f7',
        brightCyan: '#66d9e8',
        brightWhite: '#ffffff'
      },
      scrollback: 10000,
      // 关键修复：禁用 convertEol 避免字符间距问题
      convertEol: false,
      screenReaderMode: false,
      // 禁用 bell
      bellStyle: 'none',
      // 禁用右键菜单
      rightClickSelectsWord: false,
    })

    // 创建并加载 FitAddon
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    // 挂载到 DOM
    terminal.open(terminalRef.current)
    xtermRef.current = terminal

    // 显示加载提示
    terminal.write('\x1b[33m⏳ 正在启动 CLI...\x1b[0m\r\n')

    // 延迟适配以确保正确尺寸
    setTimeout(() => {
      fitAddon.fit()
    }, 100)

    // 处理用户输入
    terminal.onData((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          conversationId,
          data: { input: data }
        }))
      }
    })

    return terminal
  }, [conversationId])

  // 连接 WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState(prev => ({ ...prev, connecting: true, error: null }))
    isManualCloseRef.current = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?conversationId=${conversationId}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setState(prev => ({ ...prev, connected: true, connecting: false, error: null }))

      // 连接后调整大小
      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'output' && xtermRef.current) {
          // 收到第一条输出时标记 CLI 已就绪
          if (!state.cliReady) {
            setState(prev => ({ ...prev, cliReady: true }))
          }
          xtermRef.current.write(data.data.output)
        } else if (data.type === 'status') {
          // 处理状态消息
          if (data.data?.status === 'started') {
            setState(prev => ({ ...prev, cliReady: true }))
            // 显示提示信息
            if (xtermRef.current && !data.data.reused) {
              xtermRef.current.write('\x1b[32m✓ CLI 已就绪\x1b[0m\r\n')
            } else if (xtermRef.current && data.data.reused) {
              xtermRef.current.write('\x1b[36m✓ 复用已有会话\x1b[0m\r\n')
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }

    ws.onclose = (event) => {
      setState(prev => ({ ...prev, connected: false, connecting: false }))
      if (!isManualCloseRef.current && event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }
    }

    ws.onerror = () => {
      setState(prev => ({ ...prev, connecting: false, error: '连接失败' }))
    }
  }, [conversationId])

  // 断开连接
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close(1000)
      wsRef.current = null
    }
    setState(prev => ({ ...prev, connected: false, error: null }))
  }, [])

  // 组件挂载时初始化
  useEffect(() => {
    const terminal = initTerminal()
    connectWebSocket()

    // ResizeObserver
    if ('ResizeObserver' in window && terminalRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (fitAddonRef.current) {
          requestAnimationFrame(() => fitAddonRef.current?.fit())
        }
      })
      resizeObserverRef.current.observe(terminalRef.current)
    }

    const handleResize = () => {
      if (fitAddonRef.current) {
        requestAnimationFrame(() => fitAddonRef.current?.fit())
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (resizeObserverRef.current && terminalRef.current) {
        resizeObserverRef.current.unobserve(terminalRef.current)
        resizeObserverRef.current.disconnect()
      }
      if (wsRef.current) {
        isManualCloseRef.current = true
        wsRef.current.close()
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [initTerminal, connectWebSocket])

  const statusInfo = state.connected
    ? state.cliReady
      ? { text: '已连接', color: '#10a37f', dot: '🟢' }
      : { text: '启动中...', color: '#f59e0b', dot: '🟡' }
    : state.connecting
    ? { text: '连接中...', color: '#f59e0b', dot: '🟡' }
    : { text: '未连接', color: '#8e8ea0', dot: '⚪' }

  return (
    <div className="terminal-wrapper">
      <div className="terminal-header">
        <div className="terminal-status" style={{ color: statusInfo.color }}>
          <span className="status-dot">{statusInfo.dot}</span>
          <span className="status-text">{statusInfo.text}</span>
        </div>
        
        <div className="terminal-actions">
          {state.connected ? (
            <button onClick={disconnect} className="terminal-btn">断开</button>
          ) : (
            <button onClick={connectWebSocket} className="terminal-btn primary">重连</button>
          )}
        </div>
      </div>

      <div ref={terminalRef} className="terminal-container" />

      <style>{`
        .terminal-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 12px;
          background: #fafafa;
          overflow: hidden;
          height: 100%;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 0 4px;
          flex-shrink: 0;
        }

        .terminal-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
        }

        .terminal-actions {
          display: flex;
          gap: 8px;
        }

        .terminal-btn {
          padding: 4px 12px;
          font-size: 12px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          cursor: pointer;
          color: #1a1a1a;
          transition: all 0.2s;
        }

        .terminal-btn:hover {
          background: #f5f5f5;
        }

        .terminal-btn.primary {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        /* 关键修复：终端容器样式 */
        .terminal-container {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background: #1a1a1a; /* 深色背景 */
        }

        /* xterm 样式覆盖 */
        .terminal-container .xterm {
          padding: 8px;
          height: 100%;
        }

        .terminal-container .xterm-viewport {
          background-color: #1a1a1a !important;
        }

        .terminal-container .xterm-screen {
          background-color: #1a1a1a !important;
      }

        /* 修复黑色边框问题 */
        .terminal-container .xterm-rows {
          background-color: transparent !important;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .terminal-wrapper {
            padding: 8px;
          }

          .terminal-container .xterm {
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  )
}
