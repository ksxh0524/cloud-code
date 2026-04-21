import { useState, useCallback, useRef } from 'react'
import { authFetch } from '../lib/fetch'
import type { Message, HistoryMessage } from '../types'
import { logger } from '../lib/logger'

// 消息 ID 计数器
let msgCounter = 0

/**
 * 生成唯一消息 ID
 * @returns 时间戳-计数器格式的 ID
 */
function nextMsgId() {
  return `${Date.now()}-${msgCounter++}`
}

/**
 * useMessages Hook
 *
 * 管理消息列表，包括加载、添加和处理 WebSocket 消息
 * 支持多轮对话：自动维护历史消息上下文和 SDK Session ID
 *
 * @param conversationId - 当前会话 ID
 * @returns {
 *   messages: 消息列表
 *   isStreaming: 是否正在流式响应
 *   setIsStreaming: 设置流式状态
 *   addUserMessage: 添加用户消息
 *   loadMessages: 加载会话历史消息
 *   clearMessages: 清空消息
 *   handleWebSocketMessage: 处理 WebSocket 消息
 *   getHistoryForPrompt: 获取用于 prompt 的历史消息
 *   sdkSessionId: SDK Session ID
 *   setSdkSessionId: 设置 SDK Session ID
 * }
 */
export function useMessages(_conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sdkSessionId, setSdkSessionIdState] = useState<string | null>(null)
  const sdkSessionIdRef = useRef<string | null>(null)

  /**
   * 加载会话历史消息
   */
  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/conversations/${id}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      } else {
        setMessages([])
      }
    } catch (err) {
      logger.error('Failed to load messages', { conversationId: id, error: String(err) })
      setMessages([])
    }
  }, [])

  /**
   * 清空消息列表
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    sdkSessionIdRef.current = null
    setSdkSessionIdState(null)
  }, [])

  /**
   * 设置 SDK Session ID（同时更新 ref 和 state）
   */
  const setSdkSessionId = useCallback((id: string | null) => {
    sdkSessionIdRef.current = id
    setSdkSessionIdState(id)
  }, [])

  /**
   * 获取用于 prompt 的历史消息
   * 过滤出 user 和 assistant 的文本消息作为对话上下文
   */
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

  /**
   * 添加用户消息
   *
   * @param content - 消息内容
   * @returns 添加的消息对象
   */
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

  /**
   * 处理 WebSocket 消息
   * 根据消息类型更新消息列表
   *
   * @param msg - WebSocket 消息对象
   * @param sessionId - 当前会话 ID
   * @returns 是否处理了此消息
   */
  const handleWebSocketMessage = useCallback((msg: any, sessionId: string | null): boolean => {
    // 验证会话 ID
    if (msg.sessionId && sessionId && msg.sessionId !== sessionId) {
      return false
    }

    switch (msg.type) {
      case 'message': {
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: msg.data.role,
            content: msg.data.content,
            type: msg.data.type,
            timestamp: Date.now(),
          },
        ])
        break
      }

      case 'stream': {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.type === 'text') {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + (msg.data.delta?.text || ''),
            }
            return updated
          }
          return prev
        })
        break
      }

      case 'thinking': {
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
              ...updated[idx],
              metadata: {
                ...updated[idx].metadata,
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
        setIsStreaming(false)
        break
      }

      case 'error': {
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
    loadMessages,
    clearMessages,
    handleWebSocketMessage,
    getHistoryForPrompt,
    sdkSessionId,
    setSdkSessionId,
  }
}
