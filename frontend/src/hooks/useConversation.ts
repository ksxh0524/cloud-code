import { useState, useEffect, useCallback } from 'react'
import { Conversation, Message } from '../../../shared/types'
import { conversationApi, messageApi } from '../lib/api'

export function useConversation(currentId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  // 加载会话列表
  const loadConversations = useCallback(async () => {
    try {
      const data = await conversationApi.list()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }, [])

  // 加载消息
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true)
    try {
      const data = await messageApi.list(conversationId)
      setMessages(data)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 创建会话
  const createConversation = useCallback(async (name: string, workDir: string) => {
    try {
      const conv = await conversationApi.create(name, workDir)
      await loadConversations()
      return conv
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
    }
  }, [loadConversations])

  // 删除会话
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await conversationApi.delete(id)
      await loadConversations()
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      throw error
    }
  }, [loadConversations])

  // 发送消息
  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    try {
      const msg = await messageApi.send(conversationId, content)
      setMessages(prev => [...prev, msg])
      return msg
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }, [])

  // 切换会话时加载消息
  useEffect(() => {
    if (currentId) {
      loadMessages(currentId)
    } else {
      setMessages([])
    }
  }, [currentId, loadMessages])

  // 初始加载会话列表
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return {
    conversations,
    messages,
    loading,
    loadConversations,
    loadMessages,
    createConversation,
    deleteConversation,
    sendMessage
  }
}
