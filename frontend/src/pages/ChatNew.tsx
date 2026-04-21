import { useState, useCallback, useRef } from 'react'
import { ChatLayout } from '../components/chat/ChatLayout'
import { useAgentWebSocket } from '../hooks/useAgentWebSocket'
import { useConversations } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { toast } from '../components/Toast'

export default function ChatNew() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [hasConnected, setHasConnected] = useState(false)
  const sessionIdRef = useRef<string | null>(null)

  const { conversations, createConversation, updateConversation, deleteConversation } = useConversations()
  const { messages, isStreaming, setIsStreaming, addUserMessage, loadMessages, clearMessages, handleWebSocketMessage } = useMessages(conversationId)
  const { scrollRef } = useAutoScroll({ dependency: messages, isStreaming })

  const currentConversation = conversations.find(c => c.id === conversationId)

  const handleIncomingMessage = useCallback((msg: any) => {
    handleWebSocketMessage(msg, sessionIdRef.current)
  }, [handleWebSocketMessage])

  const { sendMessage, isConnected, sessionId } = useAgentWebSocket({
    workDir: currentConversation?.workDir || '',
    onMessage: handleIncomingMessage,
    onError: useCallback(() => {
      setIsStreaming(false)
      toast.warning('连接异常')
    }, [setIsStreaming]),
  })

  if (isConnected && !hasConnected) setHasConnected(true)

  sessionIdRef.current = sessionId

  const handleSendMessage = () => {
    if (!inputValue.trim() || isStreaming || !currentConversation) return
    addUserMessage(inputValue)
    setInputValue('')
    setIsStreaming(true)
    sendMessage({ type: 'prompt', data: { prompt: inputValue, workDir: currentConversation.workDir, ...(conversationId ? { conversationId } : {}) } })
  }

  const handleInterrupt = () => {
    sendMessage({ type: 'interrupt' })
    setIsStreaming(false)
  }

  const handleCreateConversation = async (workDir: string) => {
    const conv = await createConversation(workDir)
    if (conv) {
      setConversationId(conv.id)
      setShowSidebar(false)
      clearMessages()
    }
  }

  const handleSelectConversation = async (id: string) => {
    setConversationId(id)
    setShowSidebar(false)
    await loadMessages(id)
  }

  const handleDeleteConversation = async (id: string) => {
    const ok = await deleteConversation(id)
    if (ok && id === conversationId) {
      setConversationId(null)
      clearMessages()
    }
  }

  const handleRenameConversation = async (id: string, newName: string) => {
    await updateConversation(id, newName)
  }

  return (
    <ChatLayout
      showSidebar={showSidebar}
      onToggleSidebar={() => setShowSidebar(s => !s)}
      conversations={conversations}
      currentConversation={currentConversation}
      onSelectConversation={handleSelectConversation}
      onDeleteConversation={handleDeleteConversation}
      onRenameConversation={handleRenameConversation}
      showNewModal={showNewModal}
      onToggleNewModal={() => setShowNewModal(s => !s)}
      onCreateConversation={handleCreateConversation}
      messages={messages}
      messagesEndRef={scrollRef}
      isConnected={isConnected}
      hasConnected={hasConnected}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSendMessage={handleSendMessage}
      isStreaming={isStreaming}
      onInterrupt={handleInterrupt}
    />
  )
}
