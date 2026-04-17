import { useState, useEffect, useRef, useCallback } from 'react'

interface UseAgentWebSocketOptions {
  workDir: string
  onMessage: (message: any) => void
  onError?: (error: Error) => void
}

interface UseAgentWebSocketReturn {
  sendMessage: (message: any) => void
  isConnected: boolean
  sessionId: string | null
}

export function useAgentWebSocket({
  workDir,
  onMessage,
  onError,
}: UseAgentWebSocketOptions): UseAgentWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isReconnectingRef = useRef(false)

  const connect = useCallback(() => {
    if (isReconnectingRef.current) return
    isReconnectingRef.current = true

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`
    console.log('Connecting to WebSocket:', wsUrl)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      isReconnectingRef.current = false

      // 发送初始化消息
      ws.send(
        JSON.stringify({
          type: 'init',
          data: {
            workDir,
            env: {
              ANTHROPIC_BASE_URL: localStorage.getItem('anthropic_base_url') || '',
              ANTHROPIC_AUTH_TOKEN: localStorage.getItem('anthropic_auth_token') || '',
            },
          },
        })
      )
    }

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        console.log('Received message:', message.type)

        if (message.type === 'connected') {
          setSessionId(message.data.sessionId)
        } else if (message.type === 'initialized') {
          setSessionId(message.data.sessionId)
        } else {
          onMessage(message)
        }
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    ws.onerror = error => {
      console.error('WebSocket error:', error)
      onError?.(new Error('WebSocket connection error'))
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      isReconnectingRef.current = false

      // 自动重连
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = undefined as unknown as ReturnType<typeof setTimeout>
          connect()
        }, 3000)
      }
    }
  }, [workDir, onMessage, onError])

  const sendMessage = useCallback(
    (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else {
        console.error('WebSocket is not connected')
        onError?.(new Error('WebSocket is not connected'))
      }
    },
    [onError]
  )

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return {
    sendMessage,
    isConnected,
    sessionId,
  }
}
