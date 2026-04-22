import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatLayout } from '../components/chat/ChatLayout'
import { useAgentWebSocket } from '../hooks/useAgentWebSocket'
import { useConversations } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { toast } from '../components/Toast'
import { logger } from '../lib/logger'
import { LogViewer } from '../components/LogViewer'
import { parseSlashCommand } from '../lib/commands'
import type { WsServerMessage } from '../types'

export default function ChatNew() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showLogViewer, setShowLogViewer] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [hasConnected, setHasConnected] = useState(false)
  const sessionIdRef = useRef<string | null>(null)

  const { conversations, createConversation, updateConversation, deleteConversation } = useConversations()
  const {
    messages,
    isStreaming,
    setIsStreaming,
    addUserMessage,
    addSystemMessage,
    loadMessages,
    clearMessages,
    handleWebSocketMessage,
    getHistoryForPrompt,
    sdkSessionId: messageSdkSessionId,
    setSdkSessionId: setMessageSdkSessionId,
  } = useMessages(conversationId)
  const { scrollRef } = useAutoScroll({ dependency: messages, isStreaming })

  const currentConversation = conversations.find(c => c.id === conversationId)

  // 当 SDK Session ID 从消息 hook 更新时，同步到 WebSocket hook
  const handleSdkSessionIdChange = useCallback((id: string | null) => {
    setMessageSdkSessionId(id)
  }, [setMessageSdkSessionId])

  const handleIncomingMessage = useCallback((msg: WsServerMessage) => {
    // 捕获 done 消息中的 SDK Session ID
    if (msg.type === 'done' && msg.data?.sdkSessionId) {
      handleSdkSessionIdChange(msg.data.sdkSessionId)
    }
    handleWebSocketMessage(msg, sessionIdRef.current)
  }, [handleWebSocketMessage, handleSdkSessionIdChange])

  // 先声明一个 ref 来存储 connectionState，避免循环依赖
  const connectionStateRef = useRef<string>('connecting')

  // 处理重连完成
  const handleReconnect = useCallback(() => {
    // 重连成功后，通知用户
    toast.success('已重新连接')
    // 如果之前有未完成的流，可以尝试恢复（但流无法真正恢复，只能重置状态）
    if (isStreaming) {
      setIsStreaming(false)
    }
  }, [isStreaming, setIsStreaming])

  const {
    sendMessage,
    isConnected,
    sessionId,
    sdkSessionId,
    setSdkSessionId,
    connectionState,
  } = useAgentWebSocket({
    workDir: currentConversation?.workDir || '',
    onMessage: handleIncomingMessage,
    onError: useCallback((_error: Error) => {
      // 只有在非重连状态下才显示警告
      if (connectionStateRef.current !== 'reconnecting') {
        toast.warning('连接中断，正在尝试重连...')
      }
    }, []),
    onReconnect: handleReconnect,
  })

  // 更新 connectionStateRef
  useEffect(() => {
    connectionStateRef.current = connectionState
  }, [connectionState])

  // 同步 WebSocket 的 sdkSessionId 到 messages hook
  // 注意：只依赖 sdkSessionId，避免 messageSdkSessionId 变化导致循环
  useEffect(() => {
    if (sdkSessionId) {
      setMessageSdkSessionId(sdkSessionId)
    }
  }, [sdkSessionId])

  // 监听连接状态变化
  useEffect(() => {
    if (isConnected && !hasConnected) {
      setHasConnected(true)
    }
  }, [isConnected, hasConnected])

  sessionIdRef.current = sessionId

  const handleSendMessage = () => {
    if (!inputValue.trim() || isStreaming || !currentConversation) return

    // 拦截斜杠命令
    const parsed = parseSlashCommand(inputValue)
    if (parsed) {
      logger.userAction('slash_command', { command: parsed.command, args: parsed.args })

      switch (parsed.command) {
        case '/clear':
          clearMessages()
          setSdkSessionId(null)
          setMessageSdkSessionId(null)
          toast.success('对话已清空')
          break
        case '/compact':
          if (messageSdkSessionId) {
            sendMessage({
              type: 'prompt',
              data: {
                prompt: '/compact',
                workDir: currentConversation.workDir,
                ...(conversationId ? { conversationId } : {}),
              },
            })
            setIsStreaming(true)
          } else {
            toast.info('当前无可压缩的会话上下文')
          }
          break
        case '/help': {
          const helpText = [
            '可用命令：',
            '/clear - 清空当前对话消息',
            '/compact - 压缩对话历史以节省 token',
            '/help - 显示此帮助信息',
            '/model - 查看当前模型信息',
            '/cost - 查看 token 使用量',
            '/status - 查看连接和会话状态',
            '',
            '提示：输入 / 开头可查看命令自动补全',
          ].join('\n')
          addUserMessage('/help')
          addSystemMessage(helpText)
          break
        }
        case '/model':
          sendMessage({
            type: 'prompt',
            data: {
              prompt: 'What model are you? Respond with just your model name and version.',
              workDir: currentConversation.workDir,
              ...(conversationId ? { conversationId } : {}),
            },
          })
          setIsStreaming(true)
          break
        case '/cost':
          toast.info('Token 使用统计功能即将推出')
          break
        case '/status': {
          const statusText = [
            `连接状态: ${isConnected ? '已连接' : connectionState}`,
            `会话 ID: ${sessionIdRef.current || '无'}`,
            `SDK 会话: ${messageSdkSessionId ? '活跃' : '无'}`,
            `对话 ID: ${conversationId || '无'}`,
            `消息数: ${messages.length}`,
            `工作目录: ${currentConversation.workDir}`,
          ].join('\n')
          addUserMessage('/status')
          addSystemMessage(statusText)
          break
        }
        default:
          toast.info(`未知命令: ${parsed.command}，输入 /help 查看可用命令`)
      }
      setInputValue('')
      return
    }

    // 记录用户操作日志
    logger.userAction('send_message', {
      conversationId,
      workDir: currentConversation.workDir,
      messageLength: inputValue.length,
    })

    // 获取历史消息作为上下文
    const history = getHistoryForPrompt()

    addUserMessage(inputValue)
    setInputValue('')
    setIsStreaming(true)

    logger.debug('Sending prompt', {
      historyLength: history.length,
      conversationId,
      sdkSessionId: messageSdkSessionId,
    })

    sendMessage({
      type: 'prompt',
      data: {
        prompt: inputValue,
        workDir: currentConversation.workDir,
        ...(conversationId ? { conversationId } : {}),
        history: history.slice(-20),
      },
    })
  }

  const handleInterrupt = () => {
    sendMessage({ type: 'interrupt', data: { prompt: '', workDir: currentConversation?.workDir || '' } })
    setIsStreaming(false)
  }

  const handleCreateConversation = async (workDir: string) => {
    logger.userAction('create_conversation', { workDir })
    const conv = await createConversation(workDir)
    if (conv) {
      setConversationId(conv.id)
      setShowSidebar(false)
      clearMessages()
      setSdkSessionId(null)
      setMessageSdkSessionId(null)
      logger.info('Conversation created', { conversationId: conv.id, workDir })
    }
  }

  const handleSelectConversation = async (id: string) => {
    logger.userAction('select_conversation', { conversationId: id })
    const target = conversations.find(c => c.id === id)
    setConversationId(id)
    setShowSidebar(false)
    // 从持久化的 Conversation 恢复 SDK Session ID
    setSdkSessionId(target?.sdkSessionId || null)
    setMessageSdkSessionId(target?.sdkSessionId || null)
    await loadMessages(id)
    logger.info('Messages loaded', { conversationId: id, messageCount: messages.length })
  }

  const handleDeleteConversation = async (id: string) => {
    logger.userAction('delete_conversation', { conversationId: id })
    const ok = await deleteConversation(id)
    if (ok && id === conversationId) {
      setConversationId(null)
      clearMessages()
    }
    if (ok) {
      logger.info('Conversation deleted', { conversationId: id })
    }
  }

  const handleRenameConversation = async (id: string, newName: string) => {
    await updateConversation(id, newName)
  }

  const handleToggleSidebar = useCallback(() => setShowSidebar(s => !s), [])
  const handleToggleNewModal = useCallback(() => setShowNewModal(s => !s), [])
  const handleOpenLogViewer = useCallback(() => setShowLogViewer(true), [])
  const handleCloseLogViewer = useCallback(() => setShowLogViewer(false), [])

  return (
    <>
      <ChatLayout
        showSidebar={showSidebar}
        onToggleSidebar={handleToggleSidebar}
        conversations={conversations}
        currentConversation={currentConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        showNewModal={showNewModal}
        onToggleNewModal={handleToggleNewModal}
        onCreateConversation={handleCreateConversation}
        messages={messages}
        messagesEndRef={scrollRef}
        isConnected={isConnected}
        hasConnected={hasConnected}
        connectionState={connectionState}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        onInterrupt={handleInterrupt}
        onOpenLogViewer={handleOpenLogViewer}
      />

      <LogViewer
        isOpen={showLogViewer}
        onClose={handleCloseLogViewer}
      />
    </>
  )
}
