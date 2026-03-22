import { useEffect, useState, useRef, useCallback } from 'react'
import { WSEvent, Message, ToolCall } from '../../../shared/types'

export function useWebSocket(conversationId: string | undefined) {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // 添加新消息
  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      // 检查是否已存在（更新）
      const existingIndex = prev.findIndex(m => m.id === msg.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = msg
        return updated
      }
      // 新消息
      return [...prev, msg]
    })
  }, [])

  useEffect(() => {
    if (!conversationId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?conversationId=${conversationId}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      console.log('[WS] Connected to', wsUrl)
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('[WS] Disconnected')
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent
        console.log('[WS] Message:', data)

        switch (data.type) {
          case 'connected':
            console.log('[WS] Session connected:', data.conversationId)
            break

          case 'message':
            if (data.data) {
              addMessage({
                id: crypto.randomUUID(),
                conversationId: data.conversationId,
                ...data.data
              } as Message)
            }
            break

          case 'tool':
            console.log('[WS] Tool call:', data.data)
            // TODO: 更新工具调用状态
            break

          case 'status':
            console.log('[WS] Status:', data.data.status)
            break

          case 'error':
            console.error('[WS] Error:', data.data.error)
            break
        }
      } catch (e) {
        console.error('[WS] Invalid message:', e)
      }
    }

    return () => {
      ws.close()
    }
  }, [conversationId, addMessage])

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { connected, send, messages, addMessage }
}
