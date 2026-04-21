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
  const retryCountRef = useRef(0)
  const maxRetries = 10
  const workDirRef = useRef(workDir)

  // Keep workDir ref in sync without triggering reconnect
  useEffect(() => { workDirRef.current = workDir }, [workDir])

  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      retryCountRef.current = 0

      ws.send(JSON.stringify({
        type: 'init',
        data: { workDir: workDirRef.current },
      }))
    }

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'connected' || message.type === 'initialized') {
          setSessionId(message.data?.sessionId)
        } else {
          onMessageRef.current(message)
        }
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    }

    ws.onerror = () => {
      onErrorRef.current?.(new Error('WebSocket connection error'))
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null

      if (retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
        retryCountRef.current++
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = undefined
          connect()
        }, delay)
      }
    }
  }, []) // No workDir dependency — avoid reconnect on conversation switch

  const sendMessage = useCallback(
    (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else {
        onErrorRef.current?.(new Error('WebSocket is not connected'))
      }
    },
    []
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

  return { sendMessage, isConnected, sessionId }
}
