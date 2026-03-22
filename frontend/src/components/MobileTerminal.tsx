import { useEffect, useRef, useState, useCallback } from 'react'

interface MobileTerminalProps {
  conversationId: string
}

// Simple filter - just remove control characters, keep printable text
function cleanOutput(text: string): string {
  return text
    // Remove ANSI escape sequences
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    // Remove OSC sequences
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // Remove other control chars except \n
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim whitespace
    .trim()
}

export default function MobileTerminal({ conversationId }: MobileTerminalProps) {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<string[]>([])

  // WebSocket connection
  useEffect(() => {
    setIsLoading(true)
    linesRef.current = []
    setLines([])
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws?conversationId=${conversationId}`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setIsLoading(false)
      }
      
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'output') {
            const text = data.data.output
            const clean = cleanOutput(text)
            
            // Only add non-empty lines
            if (clean && clean.length > 0) {
              // Split by newline and add each line
              const newLines = clean.split('\n').filter(l => l.trim().length > 0)
              
              // Avoid duplicates (check last few lines)
              for (const line of newLines) {
                const recentLines = linesRef.current.slice(-5)
                if (!recentLines.includes(line)) {
                  linesRef.current.push(line)
                  // Keep only last 20 lines to prevent overflow
                  if (linesRef.current.length > 20) {
                    linesRef.current = linesRef.current.slice(-20)
                  }
                }
              }
              
              setLines([...linesRef.current])
            }
          } else if (data.type === 'history') {
            const text = data.data.content || ''
            const clean = cleanOutput(text)
            linesRef.current = clean.split('\n').filter(l => l.trim().length > 0).slice(-20)
            setLines([...linesRef.current])
          }
        } catch {}
      }
      
      ws.onclose = () => {
        setConnected(false)
        setIsLoading(false)
      }
    }
    
    connect()
    return () => wsRef.current?.close()
  }, [conversationId])

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const sendInput = useCallback(() => {
    if (!input.trim() || !wsRef.current) return
    wsRef.current.send(JSON.stringify({
      type: 'input',
      conversationId,
      data: { input: input + '\r' }
    }))
    setInput('')
  }, [input, conversationId])

  return (
    <div className="mobile-terminal">
      {/* Status Bar */}
      <div className="mobile-header">
        <div className={`mobile-status ${connected ? 'connected' : ''}`}>
          <span className="status-dot">{connected ? '●' : '○'}</span>
          <span>{connected ? '已连接' : '未连接'}</span>
        </div>
        <div className="mobile-title">Cloud Code</div>
      </div>

      {/* Output */}
      <div className="mobile-output" ref={scrollRef}>
        {isLoading ? (
          <div className="mobile-loading">
            <div className="spinner"></div>
            <span>正在连接...</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="mobile-empty">
            等待 CLI 输出...
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="mobile-line">
              {line}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="mobile-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendInput()}
          placeholder="输入命令..."
          className="mobile-input"
        />
        <button onClick={sendInput} className="mobile-send">
          发送
        </button>
      </div>

      <style>{`
        .mobile-terminal {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          background: #1a1a1a;
          color: #e5e5e5;
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          font-size: 14px;
        }

        .mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #2d2d2d;
          border-bottom: 1px solid #3d3d3d;
          flex-shrink: 0;
        }

        .mobile-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #8e8ea0;
        }

        .mobile-status.connected {
          color: #10a37f;
        }

        .status-dot {
          font-size: 10px;
        }

        .mobile-title {
          font-size: 15px;
          font-weight: 500;
          color: #fff;
        }

        .mobile-output {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          padding-bottom: 80px;
          line-height: 1.5;
        }

        .mobile-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 100%;
          color: #8e8ea0;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #3d3d3d;
          border-top-color: #10a37f;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .mobile-empty {
          text-align: center;
          color: #8e8ea0;
          padding: 40px 20px;
        }

        .mobile-line {
          margin-bottom: 2px;
          min-height: 1.4em;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .mobile-input-area {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
          background: #2d2d2d;
          border-top: 1px solid #3d3d3d;
          flex-shrink: 0;
          position: sticky;
          bottom: 0;
        }

        .mobile-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #4d4d4d;
          border-radius: 8px;
          background: #1a1a1a;
          color: #e5e5e5;
          font-size: 16px;
          outline: none;
          font-family: inherit;
        }

        .mobile-input:focus {
          border-color: #10a37f;
        }

        .mobile-send {
          padding: 10px 18px;
          background: #10a37f;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .mobile-send:active {
          opacity: 0.8;
        }

        @media (min-width: 769px) {
          .mobile-terminal {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
