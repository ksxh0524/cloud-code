import { Link } from 'react-router-dom'
import type { Conversation, Message } from '../../types'
import ConversationList from '../ConversationList'
import NewConversationModal from '../NewConversationModal'
import MessageList from '../MessageList'
import InputBox from '../InputBox'
import ConnectionBanner from '../ConnectionBanner'
import EmptyState from '../EmptyState'
import styles from './ChatLayout.module.css'

/**
 * ChatLayout 组件属性
 */
interface ChatLayoutProps {
  // 侧边栏状态
  showSidebar: boolean
  onToggleSidebar: () => void

  // 会话列表
  conversations: Conversation[]
  currentConversation: Conversation | undefined
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, newName: string) => void

  // 新建会话
  showNewModal: boolean
  onToggleNewModal: () => void
  onCreateConversation: (workDir: string) => void

  // 消息
  messages: Message[]
  messagesEndRef: React.RefObject<HTMLDivElement | null>

  // 连接状态
  isConnected: boolean
  hasConnected: boolean
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

  // 输入
  inputValue: string
  onInputChange: (value: string) => void
  onSendMessage: () => void

  // 流式响应
  isStreaming: boolean
  onInterrupt: () => void

  // 日志查看器
  onOpenLogViewer?: () => void
}

/**
 * ChatLayout 组件
 *
 * 聊天页面的布局和 UI 组件
 */
export function ChatLayout(props: ChatLayoutProps) {
  const {
    showSidebar,
    onToggleSidebar,
    conversations,
    currentConversation,
    onSelectConversation,
    onDeleteConversation,
    onRenameConversation,
    showNewModal,
    onToggleNewModal,
    onCreateConversation,
    messages,
    messagesEndRef,
    isConnected,
    hasConnected,
    connectionState,
    inputValue,
    onInputChange,
    onSendMessage,
    isStreaming,
    onInterrupt,
    onOpenLogViewer,
  } = props

  // Build status dot class dynamically
  const statusDotClass = isConnected
    ? styles.connected
    : connectionState === 'reconnecting'
      ? styles.reconnecting
      : styles.disconnected

  return (
    <div className={styles.chatContainer}>
      {/* 侧边栏遮罩 */}
      {showSidebar && (
        <div className={styles.sidebarOverlay} onClick={onToggleSidebar} />
      )}

      {/* 侧边栏 */}
      <aside className={`${styles.sidebar} ${showSidebar ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <button
            onClick={onToggleNewModal}
            className={styles.newChatBtn}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            新建对话
          </button>
          <button className={styles.closeSidebar} onClick={onToggleSidebar} aria-label="关闭侧边栏">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        </div>

        <ConversationList
          conversations={conversations}
          currentId={currentConversation?.id || null}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
          onRename={onRenameConversation}
        />

        <div className={styles.sidebarFooter}>
          <div className={styles.connectionStatus}>
            <span className={`${styles.statusDot} ${statusDotClass}`} />
            <span>
              {isConnected
                ? '已连接'
                : connectionState === 'reconnecting'
                ? '重连中...'
                : connectionState === 'connecting'
                ? '连接中...'
                : '未连接'}
            </span>
          </div>
          <Link
            to="/settings"
            className={styles.settingsLink}
            onClick={onToggleSidebar}
          >
            设置
          </Link>
          {onOpenLogViewer && (
            <button
              className={styles.settingsLink}
              onClick={() => {
                onOpenLogViewer()
                onToggleSidebar()
              }}
            >
              📝 查看日志
            </button>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className={styles.mainContent}>
        <ConnectionBanner isConnected={isConnected} hasConnected={hasConnected} />
        {/* 顶部导航 */}
        <header className={styles.chatHeader}>
          <button className={styles.menuButton} onClick={onToggleSidebar} aria-label="打开菜单">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className={styles.chatTitle}>
            {currentConversation ? currentConversation.name : 'Cloud Code'}
          </div>
          <div className={styles.headerActions}>
            {/* 连接状态指示器 */}
            <div className={styles.headerConnectionStatus}>
              <span
                className={`${styles.headerStatusDot} ${
                  isConnected
                    ? styles.headerConnected
                    : connectionState === 'reconnecting'
                      ? styles.headerReconnecting
                      : styles.headerDisconnected
                }`}
              />
              <span className={styles.headerStatusText}>
                {isConnected
                  ? '已连接'
                  : connectionState === 'reconnecting'
                    ? '重连中'
                    : connectionState === 'connecting'
                      ? '连接中'
                      : '未连接'}
              </span>
            </div>
            {isStreaming && (
              <button className={styles.interruptBtn} onClick={onInterrupt}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                停止
              </button>
            )}
          </div>
        </header>

        {/* 聊天内容 */}
        {currentConversation ? (
          <div className={styles.chatContent}>
            <div className={styles.messagesContainer}>
              {messages.length === 0 ? (
                <EmptyState hasConversation onNewConversation={onToggleNewModal} />
              ) : (
                <MessageList messages={messages} isStreaming={isStreaming} />
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputContainer}>
              {connectionState === 'reconnecting' && (
                <div className={styles.connectionWarning}>
                  连接中断，正在尝试重连 ({connectionState})...
                </div>
              )}
              <InputBox
                value={inputValue}
                onChange={onInputChange}
                onSend={onSendMessage}
                onInterrupt={onInterrupt}
                isStreaming={isStreaming}
                disabled={!isConnected}
                placeholder="输入消息..."
              />
            </div>
          </div>
        ) : (
          <EmptyState hasConversation={false} onNewConversation={onToggleNewModal} />
        )}
      </main>

      {/* 新建会话弹窗 */}
      <NewConversationModal
        open={showNewModal}
        onClose={onToggleNewModal}
        onConfirm={onCreateConversation}
      />
    </div>
  )
}
