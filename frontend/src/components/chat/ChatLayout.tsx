import { Link } from 'react-router-dom'
import type { Conversation, Message } from '../../types'
import ConversationList from '../ConversationList'
import NewConversationModal from '../NewConversationModal'
import MessageList from '../MessageList'
import InputBox from '../InputBox'
import ConnectionBanner from '../ConnectionBanner'
import EmptyState from '../EmptyState'

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

  // 输入
  inputValue: string
  onInputChange: (value: string) => void
  onSendMessage: () => void

  // 流式响应
  isStreaming: boolean
  onInterrupt: () => void
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
    inputValue,
    onInputChange,
    onSendMessage,
    isStreaming,
    onInterrupt,
  } = props

  return (
    <div className="chat-container">
      {/* 侧边栏遮罩 */}
      {showSidebar && (
        <div className="sidebar-overlay" onClick={onToggleSidebar} />
      )}

      {/* 侧边栏 */}
      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button
            onClick={onToggleNewModal}
            className="new-chat-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            新建对话
          </button>
          <button className="close-sidebar" onClick={onToggleSidebar} aria-label="关闭侧边栏">
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

        <div className="sidebar-footer">
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? '已连接' : '未连接'}</span>
          </div>
          <Link
            to="/settings"
            className="settings-link"
            onClick={onToggleSidebar}
          >
            设置
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="main-content">
        <ConnectionBanner isConnected={isConnected} hasConnected={hasConnected} />
        {/* 顶部导航 */}
        <header className="chat-header">
          <button className="menu-button" onClick={onToggleSidebar} aria-label="打开菜单">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="chat-title">
            {currentConversation ? currentConversation.name : 'Cloud Code'}
          </div>
          <div className="header-actions">
            {isStreaming && (
              <button className="interrupt-btn" onClick={onInterrupt}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                停止
              </button>
            )}
          </div>
        </header>

        {/* 聊天内容 */}
        {currentConversation ? (
          <div className="chat-content">
            <div className="messages-container">
              {messages.length === 0 ? (
                <EmptyState hasConversation onNewConversation={onToggleNewModal} />
              ) : (
                <MessageList messages={messages} isStreaming={isStreaming} />
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
              {!isConnected && (
                <div className="connection-warning">
                  WebSocket 连接已断开，正在重连...
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

      <style>{`
        .chat-container { display: flex; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; background: #fff; }
        .sidebar { width: 260px; background: #f7f7f8; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; position: relative; z-index: 100; }
        .sidebar-header { padding: 12px; border-bottom: 1px solid #e5e5e5; display: flex; gap: 8px; align-items: center; }
        .new-chat-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; background: #111; border: none; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; min-height: 42px; }
        .new-chat-btn:hover { background: #333; }
        .close-sidebar { display: none; background: none; border: none; color: #666; cursor: pointer; padding: 8px; min-width: 40px; min-height: 40px; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.15s; }
        .close-sidebar:hover { background: #eee; color: #111; }
        .sidebar-footer { padding: 12px; border-top: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 4px; }
        .connection-status { display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: 12px; color: #888; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-dot.connected { background: #16a34a; }
        .status-dot.disconnected { background: #ccc; }
        .settings-link { display: flex; align-items: center; gap: 8px; padding: 10px; color: #555; text-decoration: none; border-radius: 8px; transition: background 0.15s; font-size: 14px; min-height: 44px; }
        .settings-link:hover { background: #eee; color: #111; }
        .sidebar-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 90; cursor: pointer; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
        .chat-header { height: 56px; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; padding: 0 16px; gap: 12px; background: #fff; flex-shrink: 0; }
        .menu-button { display: none; background: none; border: none; cursor: pointer; padding: 8px; color: #333; min-width: 40px; min-height: 40px; border-radius: 8px; -webkit-tap-highlight-color: transparent; transition: background 0.15s; align-items: center; justify-content: center; }
        .menu-button:hover { background: #f0f0f0; }
        .chat-title { flex: 1; font-size: 16px; font-weight: 600; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .header-actions { display: flex; gap: 8px; }
        .interrupt-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .interrupt-btn:hover { background: #fee2e2; border-color: #fca5a5; }
        .chat-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
        .messages-container { flex: 1; overflow-y: auto; padding: 16px; -webkit-overflow-scrolling: touch; }
        .input-container { padding: 12px 16px; background: #fff; flex-shrink: 0; }
        .connection-warning { text-align: center; padding: 8px; background: #f7f7f8; color: #666; font-size: 13px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e5e5e5; }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: -260px; top: 0; bottom: 0; transition: left 0.3s ease; box-shadow: none; z-index: 100; }
          .sidebar.open { left: 0; box-shadow: 2px 0 8px rgba(0,0,0,0.15); }
          .sidebar-overlay { display: block; z-index: 95; }
          .close-sidebar { display: flex; }
          .menu-button { display: flex; }
          .messages-container { padding: 12px; }
          .input-container { padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
          .chat-header { 
            height: 56px; 
            min-height: 56px;
            padding-top: 12px;
            padding-bottom: 8px;
            flex-shrink: 0;
          }
          /* 只在真正支持安全区域的设备（刘海屏）上增加额外的顶部间距 */
          @supports (padding-top: max(0px, env(safe-area-inset-top))) {
            .chat-header { padding-top: max(12px, env(safe-area-inset-top)); }
          }
        }
      `}</style>
    </div>
  )
}
