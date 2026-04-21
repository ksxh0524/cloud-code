import { Link } from 'react-router-dom'
import type { Conversation, Message } from '../../types'
import ConversationList from '../ConversationList'
import NewConversationModal from '../NewConversationModal'
import MessageList from '../MessageList'
import InputBox from '../InputBox'

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
  messagesEndRef: React.RefObject<HTMLDivElement>

  // 连接状态
  isConnected: boolean

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
            + 新建对话
          </button>
          <button className="close-sidebar" onClick={onToggleSidebar}>
            ←
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
        {/* 顶部导航 */}
        <header className="chat-header">
          <button className="menu-button" onClick={onToggleSidebar}>
            ☰
          </button>
          <div className="chat-title">
            {currentConversation ? currentConversation.name : '请选择或创建会话'}
          </div>
          <div className="header-actions">
            {isStreaming && (
              <button className="interrupt-btn" onClick={onInterrupt}>
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
                <div className="empty-state">
                  <h2>开始对话</h2>
                  <p>输入消息开始使用 Claude Code</p>
                </div>
              ) : (
                <MessageList messages={messages} />
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
          <div className="empty-state">
            <h2>Cloud Code</h2>
            <button onClick={onToggleNewModal} className="new-chat-large-btn">
              + 新建对话
            </button>
          </div>
        )}
      </main>

      {/* 新建会话弹窗 */}
      <NewConversationModal
        open={showNewModal}
        onClose={onToggleNewModal}
        onConfirm={onCreateConversation}
      />

      <style>{`
        .chat-container { display: flex; width: 100%; height: 100vh; overflow: hidden; background: #fff; }
        .sidebar { width: 260px; background: #f7f7f8; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; position: relative; z-index: 100; }
        .sidebar-header { padding: 12px; border-bottom: 1px solid #e5e5e5; display: flex; gap: 8px; align-items: center; }
        .new-chat-btn { flex: 1; padding: 10px 12px; background: #111; border: none; border-radius: 6px; color: #fff; font-size: 14px; cursor: pointer; transition: background 0.2s; min-height: 40px; }
        .new-chat-btn:hover { background: #333; }
        .close-sidebar { display: none; background: none; border: none; font-size: 16px; color: #666; cursor: pointer; padding: 8px; min-width: 40px; min-height: 40px; align-items: center; justify-content: center; border-radius: 6px; }
        .close-sidebar:hover { color: #111; }
        .sidebar-footer { padding: 12px; border-top: 1px solid #e5e5e5; display: flex; flex-direction: column; gap: 8px; }
        .connection-status { display: flex; align-items: center; gap: 8px; padding: 8px; font-size: 12px; color: #666; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.connected { background: #111; }
        .status-dot.disconnected { background: #ccc; }
        .settings-link { display: flex; align-items: center; gap: 8px; padding: 10px; color: #111; text-decoration: none; border-radius: 6px; transition: background 0.2s; font-size: 14px; }
        .settings-link:hover { background: #eee; }
        .sidebar-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 90; cursor: pointer; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
        .chat-header { height: 56px; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; padding: 0 16px; gap: 12px; background: #fff; }
        .menu-button { display: none; background: none; border: none; font-size: 20px; cursor: pointer; padding: 8px; color: #111; min-width: 40px; min-height: 40px; border-radius: 6px; }
        .menu-button:hover { background: #f0f0f0; }
        .chat-title { flex: 1; font-size: 16px; font-weight: 500; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .header-actions { display: flex; gap: 8px; }
        .interrupt-btn { padding: 8px 12px; background: #f0f0f0; color: #111; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 13px; cursor: pointer; transition: background 0.2s; }
        .interrupt-btn:hover { background: #e5e5e5; }
        .chat-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .messages-container { flex: 1; overflow-y: auto; padding: 16px; }
        .input-container { padding: 16px; border-top: 1px solid #e5e5e5; background: #fff; }
        .connection-warning { text-align: center; padding: 8px; background: #f7f7f8; color: #666; font-size: 13px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e5e5e5; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; text-align: center; padding: 20px; }
        .empty-state h2 { font-size: 20px; margin-bottom: 8px; color: #111; }
        .empty-state p { font-size: 14px; margin-bottom: 24px; }
        .new-chat-large-btn { margin-top: 20px; padding: 14px 28px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500; min-height: 48px; transition: background 0.2s; }
        .new-chat-large-btn:hover { background: #333; }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: -260px; top: 0; bottom: 0; transition: left 0.3s ease; box-shadow: none; z-index: 100; }
          .sidebar.open { left: 0; box-shadow: 2px 0 8px rgba(0,0,0,0.15); }
          .sidebar-overlay { display: block; z-index: 95; }
          .close-sidebar { display: flex; }
          .menu-button { display: block; }
          .messages-container { padding: 12px; }
          .input-container { padding: 12px; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
          .chat-header { padding-top: max(12px, env(safe-area-inset-top)); }
        }
      `}</style>
    </div>
  )
}
