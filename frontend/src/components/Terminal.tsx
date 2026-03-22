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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const isManualCloseRef = useRef(false)
  const isConnectingRef = useRef(false)
  const conversationIdRef = useRef(conversationId)

  const [state, setState] = useState<TerminalState>({
    connected: false,
    connecting: false,
    cliReady: false,
    error: null
  })

  // Initialize terminal - only once
  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || xtermRef.current) return
    
    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'underline',
      fontSize: 14,
      fontFamily: '"SF Mono", "Apple Braille", "Menlo", "Monaco", "Courier New", "Segoe UI Symbol", "Noto Sans Symbols", monospace',
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.2,
      theme: {
        background: '#1a1a1a',
        foreground: '#e5e5e5',
        cursor: '#10a37f',
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
      convertEol: true,
      screenReaderMode: false,
      rightClickSelectsWord: false,
      allowProposedApi: true,
      allowTransparency: false,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon

    terminal.open(terminalRef.current)
    xtermRef.current = terminal

    terminal.write('\x1b[33m⏳ 正在启动 CLI...\x1b[0m\r\n')

    setTimeout(() => {
      fitAddon.fit()
    }, 100)

    terminal.onData((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          conversationId: conversationIdRef.current,
          data: { input: data }
        }))
      }
    })

    return terminal
  }, [])

  // Connect WebSocket - stable reference
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping')
      return
    }
    
    if (isConnectingRef.current) {
      console.log('WebSocket connection in progress, skipping')
      return
    }
    
    isConnectingRef.current = true

    console.log('Connecting WebSocket for conversation:', conversationIdRef.current)
    setState(prev => ({ ...prev, connecting: true, error: null }))
    isManualCloseRef.current = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?conversationId=${conversationIdRef.current}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      isConnectingRef.current = false
      setState(prev => ({ ...prev, connected: true, connecting: false, error: null }))

      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'output' && xtermRef.current) {
          setState(prev => {
            if (!prev.cliReady) {
              return { ...prev, cliReady: true }
            }
            return prev
          })
          xtermRef.current.write(data.data.output)
        } else if (data.type === 'history' && xtermRef.current) {
          // Handle history message for reused sessions
          console.log('Received history, writing to terminal')
          if (data.data?.content) {
            xtermRef.current.clear()
            xtermRef.current.write(data.data.content)
            setState(prev => ({ ...prev, cliReady: true }))
          }
        } else if (data.type === 'status') {
          if (data.data?.status === 'started') {
            setState(prev => ({ ...prev, cliReady: true }))
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code)
      isConnectingRef.current = false
      setState(prev => ({ ...prev, connected: false, connecting: false }))
      if (!isManualCloseRef.current && event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      isConnectingRef.current = false
      setState(prev => ({ ...prev, connecting: false, error: '连接失败' }))
    }
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    console.log('Manually disconnecting')
    isManualCloseRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000)
      wsRef.current = null
    }
    setState(prev => ({ ...prev, connected: false, error: null }))
  }, [])

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await initTerminal()
      connectWebSocket()
    }
    init()

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
    
    /* Via browser fix: refit on visibility change */
    const handleVisibilityChange = () => {
      if (!document.hidden && fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      console.log('Terminal component unmounting, cleaning up...')
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (resizeObserverRef.current && terminalRef.current) {
        resizeObserverRef.current.unobserve(terminalRef.current)
        resizeObserverRef.current.disconnect()
      }
      if (wsRef.current) {
        isManualCloseRef.current = true
        wsRef.current.close()
        wsRef.current = null
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [])

  // Handle conversationId change
  useEffect(() => {
    if (conversationIdRef.current !== conversationId) {
      console.log('Conversation ID changed from', conversationIdRef.current, 'to', conversationId)
      conversationIdRef.current = conversationId
      
      // Disconnect old
      if (wsRef.current) {
        isManualCloseRef.current = true
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      // Clear terminal
      if (xtermRef.current) {
        xtermRef.current.clear()
        xtermRef.current.write('\x1b[33m⏳ 正在启动 CLI...\x1b[0m\r\n')
      }
      
      // Reset state
      setState({ connected: false, connecting: false, cliReady: false, error: null })
      
      // Connect new
      setTimeout(() => {
        connectWebSocket()
      }, 100)
    }
  }, [conversationId, connectWebSocket])

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
        <div className="terminal-title-row">
          <span className="terminal-title">Cloud Code Terminal</span>
          <span className="terminal-divider">|</span>
          <span className="terminal-status" style={{ color: statusInfo.color }}>
            <span className="status-dot">{statusInfo.dot}</span>
            <span className="status-text">{statusInfo.text}</span>
          </span>
        </div>
        
        <div className="terminal-actions">
          {state.connected ? (
            <button onClick={disconnect} className="terminal-btn">断开</button>
          ) : (
            <button onClick={connectWebSocket} className="terminal-btn primary">重连</button>
          )}
        </div>
      </div>

      <div 
        ref={terminalRef} 
        className="terminal-container"
        onClick={() => {
          if (xtermRef.current) {
            xtermRef.current.focus()
          }
        }}
        style={{ cursor: 'text' }}
      />

      <style>{`
        .terminal-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: #f9f9f9;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #ffffff;
          border-bottom: 1px solid #e5e5e5;
        }

        .terminal-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-dot {
          font-size: 12px;
        }

        .terminal-actions {
          display: flex;
          gap: 8px;
        }

        .terminal-btn {
          padding: 8px 16px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          color: #2e2e2e;
          min-height: 36px;
          transition: all 0.2s;
        }

        .terminal-btn:hover {
          background: #f7f7f8;
        }

        .terminal-btn.primary {
          background: #2e2e2e;
          color: #ffffff;
          border-color: #2e2e2e;
        }

        .terminal-btn.primary:hover {
          background: #1a1a1a;
        }

        .terminal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .terminal-container {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background: #1a1a1a;
          margin: 16px;
          position: relative;
        }

        .terminal-container .xterm {
          padding: 8px;
          height: 100%;
          width: 100%;
        }

        .terminal-container .xterm-viewport {
          background-color: #1a1a1a !important;
          width: 100% !important;
        }

        .terminal-container .xterm-screen {
          background-color: #1a1a1a !important;
          width: 100% !important;
        }

        .terminal-container .xterm-rows {
          background-color: transparent !important;
          width: 100% !important;
        }

        /* Hide empty rows that show as lines */
        .terminal-container .xterm-rows .xterm-row:empty {
          display: none;
        }

        @media (max-width: 768px) {
          .terminal-wrapper {
            padding: 0;
          }

          .terminal-header {
            padding: 8px 12px;
            min-height: 44px;
          }

          .terminal-container {
            margin: 8px;
            border-radius: 8px;
            flex: 1;
          }

          .terminal-container .xterm {
            font-size: 12px !important;
            font-family: 'SF Mono', 'Apple Braille', 'Menlo', 'Monaco', 'Courier New', 'Segoe UI Symbol', 'Noto Sans Symbols', monospace !important;
            height: 100%;
          }

          .terminal-container .xterm-rows {
            line-height: 1.3 !important;
          }

          .terminal-btn {
            min-height: 36px;
            padding: 6px 12px;
            font-size: 13px;
          }
          
          .status-text {
            font-size: 13px;
          }
        }

        @supports (-webkit-touch-callout: none) {
          /* iOS Safari and WebKit browsers like Via */
          .terminal-container .xterm {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            height: 100% !important;
            min-height: 100% !important;
          }
          
          .terminal-container .xterm-viewport {
            height: 100% !important;
          }
          
          /* Remove extra lines/spaces */
          .terminal-container .xterm-rows > div:empty,
          .terminal-container .xterm-rows > span:empty {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            line-height: 0 !important;
          }
        }
        
        /* Via browser specific fix */
        @media screen and (max-width: 768px) {
          .terminal-container * {
            -webkit-text-size-adjust: none;
            text-size-adjust: none;
          }
          
          .terminal-container .xterm-rows {
            contain: layout style paint;
          }
        }
      `}</style>
    </div>
  )
}
