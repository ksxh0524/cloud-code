import { useState, useCallback, useEffect } from 'react'
import { authFetch } from '../lib/fetch'
import { toast } from '../components/Toast'
import type { Conversation } from '../types'
import { logger } from '../lib/logger'

/**
 * useConversations Hook
 *
 * 管理会话列表的加载、创建、更新和删除
 *
 * @returns {
 *   conversations: 会话列表
 *   loadConversations: 重新加载会话列表
 *   createConversation: 创建新会话
 *   updateConversation: 更新会话
 *   deleteConversation: 删除会话
 * }
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])

  /**
   * 加载会话列表
   * 从后端 API 获取并按更新时间排序
   */
  const loadConversations = useCallback(async () => {
    try {
      const res = await authFetch('/api/conversations')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConversations(data)
    } catch (error) {
      logger.error('Failed to load conversations', { error: String(error) })
      toast.error('加载对话列表失败')
    }
  }, [])

  // 组件挂载时加载会话
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  /**
   * 创建新会话
   *
   * @param workDir - 工作目录路径
   * @returns 新创建的会话，失败返回 null
   */
  const createConversation = useCallback(async (workDir: string): Promise<Conversation | null> => {
    // 根据工作目录生成会话名称
    const dirName = workDir.split('/').filter(Boolean).pop() || workDir
    const sameDirConversations = conversations.filter(c => c.workDir === workDir)

    let conversationName = dirName
    if (sameDirConversations.length > 0) {
      let suffix = 1
      while (sameDirConversations.some(c => c.name === `${dirName}${suffix}`)) {
        suffix++
      }
      conversationName = `${dirName}${suffix}`
    }

    try {
      const res = await authFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: conversationName,
          workDir,
          cliType: 'claude',
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const conv = await res.json()
      await loadConversations()
      return conv
    } catch (error) {
      logger.error('Failed to create conversation', { workDir, error: String(error) })
      toast.error('创建对话失败')
      return null
    }
  }, [conversations, loadConversations])

  /**
   * 更新会话名称
   *
   * @param id - 会话 ID
   * @param newName - 新名称
   * @returns 是否成功
   */
  const updateConversation = useCallback(async (id: string, newName: string): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setConversations(prev =>
        prev.map(c => (c.id === id ? { ...c, name: newName } : c))
      )
      return true
    } catch (error) {
      logger.error('Failed to rename conversation', { id, newName, error: String(error) })
      toast.error('重命名失败')
      return false
    }
  }, [])

  /**
   * 删除会话
   *
   * @param id - 会话 ID
   * @returns 是否成功
   */
  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await authFetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setConversations(prev => prev.filter(c => c.id !== id))
      return true
    } catch (error) {
      logger.error('Failed to delete conversation', { id, error: String(error) })
      toast.error('删除对话失败')
      return false
    }
  }, [])

  return {
    conversations,
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation,
  }
}
