import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import ConversationList from '../components/ConversationList'
import NewConversationModal from '../components/NewConversationModal'
import MessageList from '../components/MessageList'
import InputBox from '../components/InputBox'
import { useAgentWebSocket } from '../hooks/useAgentWebSocket'
import { authFetch } from '../lib/fetch'
import type { Conversation, Message } from '../types'

let msgCounter = 0
function nextMsgId() {
  return `${Date.now()}-${msgCounter++}`
}

export default function ChatNew() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentConversation = conversations.find(c => c.id === conversationId)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const res = await authFetch('/api/conversations')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConversations(await res.json())
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const handleIncomingMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'message':
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

      case 'stream':
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

      case 'thinking':
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

      case 'tool_call':
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'assistant',
            content: `Using: ${msg.data.toolName}`,
            type: 'tool_use',
            metadata: {
              toolName: msg.data.toolName,
              toolInput: msg.data.toolInput,
            },
            timestamp: Date.now(),
          },
        ])
        break

      case 'tool_result':
        setMessages(prev => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'tool',
            content: msg.data.toolOutput,
            type: 'tool_result',
            metadata: {
              toolName: msg.data.toolName,
            },
            timestamp: Date.now(),
          },
        ])
        break

      case 'done':
        setIsStreaming(false)
        break

      case 'error':
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
  }, [])

  const { sendMessage, isConnected } = useAgentWebSocket({
    workDir: currentConversation?.workDir || '',
    onMessage: handleIncomingMessage,
    onError: useCallback(() => setIsStreaming(false), []),
  })

  const handleSendMessage = () => {
    if (!inputValue.trim() || isStreaming || !currentConversation) return

    setMessages(prev => [
      ...prev,
      {
        id: nextMsgId(),
        role: 'user',
        content: inputValue,
        type: 'text',
        timestamp: Date.now(),
      },
    ])
    setInputValue('')
    setIsStreaming(true)

    sendMessage({
      type: 'prompt',
      data: {
        prompt: inputValue,
        workDir: currentConversation.workDir,
        conversationId: conversationId,
      },
    })
  }

  const handleInterrupt = () => {
    sendMessage({ type: 'interrupt' })
    setIsStreaming(false)
  }

  const handleCreateConversation = async (workDir: string, cliType: string = 'claude') => {
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
        body: JSON.stringify({ name: conversationName, workDir, cliType }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const conv = await res.json()
      setConversationId(conv.id)
      setShowSidebar(false)
      setMessages([])
      loadConversations()
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectConversation = async (id: string) => {
    setConversationId(id)
    setShowSidebar(false)
    try {
      const res = await authFetch(`/api/conversations/${id}/messages`)
      if (res.ok) {
        setMessages(await res.json())
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }

  return (
    <div className="chat-container">
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button
            onClick={() => {
              setShowNewModal(true)
              setShowSidebar(false)
            }}
            className="new-chat-btn"
          >
            + 新建对话
          </button>
          <button className="close-sidebar" onClick={() => setShowSidebar(false)}>
            &larr;
          </button>
        </div>

        <ConversationList
          conversations={conversations}
          currentId={conversationId}
          onSelect={handleSelectConversation}
          onDelete={async id => {
            try {
              const res = await authFetch(`/api/conversations/${id}`, { method: 'DELETE' })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              if (id === conversationId) {
                setConversationId(null)
                setMessages([])
              }
              setConversations(prev => prev.filter(c => c.id !== id))
            } catch (error) {
              console.error('Delete failed:', error)
            }
          }}
          onRename={async (id, newName) => {
            try {
              const res = await authFetch(`/api/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              setConversations(prev => prev.map(c => (c.id === id ? { ...c, name: newName } : c)))
            } catch (error) {
              console.error('Rename failed:', error)
            }
          }}
        />

        <div className="sidebar-footer">
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? '已连接' : '未连接'}</span>
          </div>
          <Link to="/settings" className="settings-link" onClick={() => setShowSidebar(false)}>
            设置
          </Link>
        </div>
      </aside>

      <main className="main-content">
        <header className="chat-header">
          <button className="menu-button" onClick={() => setShowSidebar(true)} aria-label="打开菜单">
            &#9776;
          </button>
          <div className="chat-title">
            {currentConversation ? currentConversation.name : '请选择或创建会话'}
          </div>
          <div className="header-actions">
            {isStreaming && (
              <button className="interrupt-btn" onClick={handleInterrupt}>
                停止
              </button>
            )}
          </div>
        </header>

        {conversationId ? (
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
                <div className="connection-warning">WebSocket 连接已断开，正在重连...</div>
              )}
              <InputBox
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                onInterrupt={handleInterrupt}
                isStreaming={isStreaming}
                disabled={!isConnected}
                placeholder="输入消息..."
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h2>欢迎使用 Cloud Code</h2>
            <button onClick={() => setShowNewModal(true)} className="new-chat-large-btn">
              + 新建对话
            </button>
          </div>
        )}
      </main>

      <NewConversationModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onConfirm={handleCreateConversation}
      />

      <style>{`
        .chat-container {
          display: flex;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #ffffff;
        }

        .sidebar {
          width: 260px;
          background: #f9f9f9;
          border-right: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 100;
        }

        .sidebar-header {
          padding: 12px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .new-chat-btn {
          flex: 1;
          padding: 10px 12px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
          min-height: 40px;
        }

        .new-chat-btn:hover {
          background: #2563eb;
        }

        .close-sidebar {
          display: none;
          background: none;
          border: none;
          font-size: 18px;
          color: #675676;
          cursor: pointer;
          padding: 8px;
          min-width: 40px;
          min-height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background: #10b981;
        }

        .status-dot.disconnected {
          background: #ef4444;
        }

        .settings-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          color: #2e2e2e;
          text-decoration: none;
          border-radius: 6px;
          transition: background 0.2s;
          font-size: 14px;
        }

        .settings-link:hover {
          background: #e5e5e5;
        }

        .sidebar-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 90;
          cursor: pointer;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #ffffff;
        }

        .chat-header {
          height: 56px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          background: #ffffff;
        }

        .menu-button {
          display: none;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          color: #2e2e2e;
          min-width: 40px;
          min-height: 40px;
          border-radius: 6px;
        }

        .menu-button:hover {
          background: #f3f4f6;
        }

        .chat-title {
          flex: 1;
          font-size: 16px;
          font-weight: 500;
          color: #2e2e2e;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .interrupt-btn {
          padding: 8px 12px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .interrupt-btn:hover {
          background: #dc2626;
        }

        .chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .input-container {
          padding: 16px;
          border-top: 1px solid #e5e5e5;
          background: #ffffff;
        }

        .connection-warning {
          text-align: center;
          padding: 8px;
          background: #fef3c7;
          color: #92400e;
          font-size: 13px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #8e8ea0;
          text-align: center;
          padding: 20px;
        }

        .empty-state h2 {
          font-size: 20px;
          margin-bottom: 8px;
          color: #2e2e2e;
        }

        .empty-state p {
          font-size: 14px;
          margin-bottom: 24px;
        }

        .new-chat-large-btn {
          margin-top: 20px;
          padding: 14px 28px;
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 500;
          min-height: 48px;
          transition: background 0.2s;
        }

        .new-chat-large-btn:hover {
          background: #2563eb;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -260px;
            top: 0;
            bottom: 0;
            transition: left 0.3s ease;
            box-shadow: none;
            z-index: 100;
          }

          .sidebar.open {
            left: 0;
            box-shadow: 2px 0 8px rgba(0,0,0,0.15);
          }

          .sidebar-overlay {
            display: block;
            z-index: 95;
          }

          .close-sidebar {
            display: flex;
          }

          .menu-button {
            display: block;
          }

          .messages-container {
            padding: 12px;
          }

          .input-container {
            padding: 12px;
            padding-bottom: max(12px, env(safe-area-inset-bottom));
          }

          .chat-header {
            padding-top: max(12px, env(safe-area-inset-top));
          }
        }
      `}</style>
    </div>
  )
}
