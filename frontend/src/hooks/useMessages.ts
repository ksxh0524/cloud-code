import { useState, useCallback, useRef } from 'react'
import { authFetch } from '../lib/fetch'
import type { Message, HistoryMessage, WsServerMessage } from '../types'
import { logger } from '../lib/logger'

/**
 * 生成唯一消息ID
 * 使用当前时间戳 + 随机字符串 + 性能计数器，确保ID唯一性
 */
function nextMsgId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 11)
  const counter = performance.now().toString(36).substring(2, 8)
  return `msg-${timestamp}-${random}-${counter}`
}

export function useMessages(_conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sdkSessionId, setSdkSessionIdState] = useState<string | null>(null)
  const sdkSessionIdRef = useRef<string | null>(null)
  const streamingMsgIdRef = useRef<string | null>(null)
  const streamingContentRef = useRef<string>('')

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/conversations/${id}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      logger.error('Failed to load messages', { conversationId: id, error: String(err) })
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    sdkSessionIdRef.current = null
    setSdkSessionIdState(null)
    streamingMsgIdRef.current = null
    streamingContentRef.current = ''
  }, [])

  const setSdkSessionId = useCallback((id: string | null) => {
    sdkSessionIdRef.current = id
    setSdkSessionIdState(id)
  }, [])

  const getHistoryForPrompt = useCallback((): HistoryMessage[] => {
    return messages
      .filter((msg): msg is Message & { role: 'user' | 'assistant'; type: 'text' } =>
        (msg.role === 'user' || msg.role === 'assistant') &&
        (msg.type === 'text' || msg.type === undefined) &&
        msg.content.trim().length > 0
      )
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }))
  }, [messages])

  const addUserMessage = useCallback((content: string): Message => {
    const msg: Message = {
      id: nextMsgId(),
      role: 'user',
      content,
      type: 'text',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  const addSystemMessage = useCallback((content: string): void => {
    setMessages(prev => [...prev, {
      id: nextMsgId(),
      role: 'system',
      content,
      type: 'text',
      timestamp: Date.now(),
    }])
  }, [])

  const handleWebSocketMessage = useCallback((msg: WsServerMessage, sessionId: string | null): boolean => {
    if (msg.sessionId && sessionId && msg.sessionId !== sessionId) {
      return false
    }

    switch (msg.type) {
      case 'stream': {
        const text = msg.data.delta?.text || ''
        const newContent = streamingContentRef.current + text
        streamingContentRef.current = newContent

        if (!streamingMsgIdRef.current) {
          const id = nextMsgId()
          streamingMsgIdRef.current = id
          setMessages(prev => [
            ...prev,
            { id, role: 'assistant', content: newContent, type: 'text', timestamp: Date.now() },
          ])
        } else {
          setMessages(prev => {
            const streamingId = streamingMsgIdRef.current
            const idx = prev.findIndex(m => m.id === streamingId)
            if (idx !== -1) {
              const updated = [...prev]
              updated[idx] = { ...updated[idx]!, content: newContent }
              return updated
            }
            return prev
          })
        }
        break
      }

      case 'message': {
        // 完整消息到达时，替换流式内容
        if (streamingMsgIdRef.current) {
          const streamingId = streamingMsgIdRef.current
          streamingMsgIdRef.current = null
          streamingContentRef.current = ''
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === streamingId)
            if (idx !== -1) {
              const updated = [...prev]
              updated[idx] = {
                ...updated[idx]!,
                role: msg.data.role as Message['role'],
                content: msg.data.content,
                type: msg.data.type as Message['type'],
              }
              return updated
            }
            return prev
          })
        } else {
          setMessages(prev => [
            ...prev,
            {
              id: nextMsgId(),
              role: msg.data.role as Message['role'],
              content: msg.data.content,
              type: msg.data.type as Message['type'],
              timestamp: Date.now(),
            },
          ])
        }
        break
      }

      case 'thinking': {
        streamingMsgIdRef.current = null
        streamingContentRef.current = ''
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'assistant',
            content: msg.data.content,
            type: 'thinking',
            timestamp: Date.now(),
          },
        ])
        break
      }

      case 'tool_call': {
        streamingMsgIdRef.current = null
        streamingContentRef.current = ''
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'assistant',
            content: '',
            type: 'tool_use',
            metadata: {
              toolId: msg.data.toolId,
              toolName: msg.data.toolName,
              toolInput: msg.data.toolInput,
            },
            timestamp: Date.now(),
          },
        ])
        break
      }

      case 'tool_result': {
        setMessages(prev => {
          const toolId = msg.data.toolId
          const idx = prev.findIndex(
            m => m.type === 'tool_use' && m.metadata?.toolId === toolId
          )
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx]!,
              metadata: {
                ...updated[idx]!.metadata,
                toolOutput: msg.data.toolOutput,
              },
            }
            return updated
          }
          return [...prev, {
            id: nextMsgId(),
            role: 'tool',
            content: msg.data.toolOutput,
            type: 'tool_result',
            metadata: { toolId: msg.data.toolId, toolName: msg.data.toolName },
            timestamp: Date.now(),
          }]
        })
        break
      }

      case 'done': {
        streamingMsgIdRef.current = null
        streamingContentRef.current = ''
        setIsStreaming(false)
        break
      }

      case 'error': {
        streamingMsgIdRef.current = null
        streamingContentRef.current = ''
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'system',
            content: `Error: ${msg.data}`,
            type: 'text',
            timestamp: Date.now(),
          },
        ])
        setIsStreaming(false)
        break
      }

      default:
        return false
    }

    return true
  }, [])

  return {
    messages,
    isStreaming,
    setIsStreaming,
    addUserMessage,
    addSystemMessage,
    loadMessages,
    clearMessages,
    handleWebSocketMessage,
    getHistoryForPrompt,
    sdkSessionId,
    setSdkSessionId,
  }
}
