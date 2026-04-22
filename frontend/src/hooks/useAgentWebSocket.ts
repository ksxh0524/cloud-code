import { useState, useEffect, useRef, useCallback } from 'react'
import type { HistoryMessage, WsServerMessage } from '../types'
import { logger } from '../lib/logger'

interface PromptData {
  prompt: string
  workDir: string
  conversationId?: string
  history?: HistoryMessage[]
  sdkSessionId?: string
}

interface UseAgentWebSocketOptions {
  workDir: string
  onMessage: (message: WsServerMessage) => void
  onError?: (error: Error) => void
  onReconnect?: () => void
}

interface UseAgentWebSocketReturn {
  sendMessage: (message: { type: string; data: PromptData }) => void
  isConnected: boolean
  sessionId: string | null
  sdkSessionId: string | null
  setSdkSessionId: (id: string | null) => void
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
}

export function useAgentWebSocket({
  workDir,
  onMessage,
  onError,
  onReconnect,
}: UseAgentWebSocketOptions): UseAgentWebSocketReturn {
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sdkSessionId, setSdkSessionIdState] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retryCountRef = useRef(0)
  const activeRef = useRef(true)
  const maxRetries = 10
  const workDirRef = useRef(workDir)
  const sdkSessionIdRef = useRef<string | null>(null)
  const onReconnectRef = useRef(onReconnect)
  const messageQueueRef = useRef<string[]>([])
  const MAX_QUEUE_SIZE = 10

  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

  // Keep workDir ref in sync without triggering reconnect
  useEffect(() => { workDirRef.current = workDir }, [workDir])

  const setSdkSessionId = useCallback((id: string | null) => {
    sdkSessionIdRef.current = id
    setSdkSessionIdState(id)
  }, [])

  // Keep sdkSessionId ref in sync
  useEffect(() => { sdkSessionIdRef.current = sdkSessionId }, [sdkSessionId])

  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const connect = useCallback(() => {
    // Close any stale connection first (prevents orphaned connections from StrictMode)
    if (wsRef.current) {
      const old = wsRef.current
      old.onclose = null
      old.close()
      wsRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    setConnectionState('connecting')

    ws.onopen = () => {
      logger.info('WebSocket connected', { workDir: workDirRef.current })

      const wasReconnecting = retryCountRef.current > 0
      retryCountRef.current = 0

      ws.send(JSON.stringify({
        type: 'init',
        data: { workDir: workDirRef.current },
      }))

      // 如果是重连成功，触发回调并发送排队消息
      if (wasReconnecting) {
        onReconnectRef.current?.()
        const queued = messageQueueRef.current
        messageQueueRef.current = []
        for (const msg of queued) {
          ws.send(msg)
        }
      }
    }

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data)

        // 记录消息日志（排除频繁的 stream 消息）
        if (message.type !== 'stream' && message.type !== 'message') {
          logger.debug(`WebSocket message: ${message.type}`, { sessionId: message.sessionId })
        }

        if (message.type === 'connected') {
          logger.info('WebSocket connected', { sessionId: message.data?.sessionId })
          setSessionId(message.data?.sessionId)
        } else if (message.type === 'initialized') {
          logger.info('WebSocket initialized', { sessionId: message.data?.sessionId })
          setSessionId(message.data?.sessionId)
          setIsConnected(true)
          setConnectionState('connected')
        } else if (message.type === 'done' && message.data?.sdkSessionId) {
          // 捕获 SDK Session ID 用于会话恢复
          logger.info('SDK Session ID captured', { sdkSessionId: message.data.sdkSessionId })
          setSdkSessionId(message.data.sdkSessionId)
          onMessageRef.current(message)
        } else if (message.type === 'error') {
          logger.error('WebSocket error message', { error: message.data })
          onMessageRef.current(message)
        } else {
          onMessageRef.current(message)
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error: String(error) })
      }
    }

    ws.onerror = (error) => {
      logger.error('WebSocket error', { error: String(error) })
      onErrorRef.current?.(new Error('WebSocket connection error'))
    }

    ws.onclose = (event) => {
      logger.warn('WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })
      setIsConnected(false)
      if (wsRef.current === ws) {
        wsRef.current = null
      }

      // 正常关闭（code 1000/1001）不重连
      if (event.code === 1000 || event.code === 1001) {
        setConnectionState('disconnected')
        return
      }

      // Only reconnect if component is still active
      if (activeRef.current && retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
        logger.info(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`)
        setConnectionState('reconnecting')
        retryCountRef.current++
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = undefined
          connect()
        }, delay)
      } else {
        setConnectionState('disconnected')
        if (retryCountRef.current >= maxRetries) {
          logger.error('Max reconnection attempts reached')
        }
      }
    }
  }, [setSdkSessionId])

  const sendMessage = useCallback(
    (message: { type: string; data: PromptData }) => {
      const messageToSend = message.type === 'prompt' && sdkSessionIdRef.current
        ? { ...message, data: { ...message.data, sdkSessionId: sdkSessionIdRef.current } }
        : message

      const serialized = JSON.stringify(messageToSend)

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        logger.debug(`Sending message: ${message.type}`)
        wsRef.current.send(serialized)
      } else if (connectionState === 'reconnecting' || connectionState === 'connecting') {
        if (messageQueueRef.current.length < MAX_QUEUE_SIZE) {
          messageQueueRef.current.push(serialized)
          logger.info(`Queued message (queue: ${messageQueueRef.current.length})`)
        } else {
          logger.error('Message queue full, dropping message')
          onErrorRef.current?.(new Error('连接恢复中，消息队列已满'))
        }
      } else {
        logger.error('Failed to send message: WebSocket not connected')
        onErrorRef.current?.(new Error('WebSocket is not connected'))
      }
    },
    [connectionState]
  )

  useEffect(() => {
    activeRef.current = true
    connect()

    return () => {
      activeRef.current = false
      logger.info('WebSocket hook cleanup')
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
      if (wsRef.current) {
        const ws = wsRef.current
        ws.onclose = null // Prevent reconnect after intentional close
        ws.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { sendMessage, isConnected, sessionId, sdkSessionId, setSdkSessionId, connectionState }
}
