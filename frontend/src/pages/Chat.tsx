import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ConversationList from '../components/ConversationList'
import NewConversationModal from '../components/NewConversationModal'
import Terminal from '../components/Terminal'
import MobileTerminal from '../components/MobileTerminal'
import { Conversation } from '../types'

export default function Chat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Read conversationId from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const convId = params.get('conv')
    if (convId) {
      setConversationId(convId)
    }
  }, [])

  // 加载会话列表
  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const handleCreateConversation = async (workDir: string, cliType: 'claude' | 'opencode' = 'claude') => {
    // 从路径中提取目录名作为会话名
    const dirName = workDir.split('/').filter(Boolean).pop() || workDir

    // 检查已存在的同名会话，生成唯一名称
    const sameDirConversations = conversations.filter((c: Conversation) => c.workDir === workDir)
    let conversationName = dirName

    if (sameDirConversations.length > 0) {
      let suffix = 1
      while (sameDirConversations.some((c: Conversation) => c.name === `${dirName}${suffix}`)) {
        suffix++
      }
      conversationName = `${dirName}${suffix}`
    }

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: conversationName, workDir, cliType })
      })
      const conv = await res.json()
      setConversationId(conv.id)
      setShowSidebar(false)
      // 重新加载会话列表
      loadConversations()
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  return (
    <div className="chat-container">
      {showSidebar && (
        <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />
      )}

      <aside className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button onClick={() => {
            setShowNewModal(true)
            setShowSidebar(false)
          }} className="new-chat-btn">
            + 新建对话
          </button>
          <button className="close-sidebar" onClick={() => setShowSidebar(false)}>
            ←
          </button>
        </div>

        <ConversationList
          conversations={conversations}
          currentId={conversationId}
          onSelect={(id) => {
            setConversationId(id)
            setShowSidebar(false)
          }}
          onCreate={() => setShowNewModal(true)}
          onDelete={async (id) => {
            try {
              await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
              if (id === conversationId) {
                setConversationId(null)
              }
              // 使用状态更新而非页面刷新
              setConversations(prev => prev.filter(c => c.id !== id))
            } catch (error) {
              console.error('Delete failed:', error)
            }
          }}
          onRename={async (id, newName) => {
            try {
              await fetch(`/api/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
              })
              // 使用状态更新而非页面刷新
              setConversations(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
            } catch (error) {
              console.error('Rename failed:', error)
            }
          }}
        />

        <div className="sidebar-footer">
          <Link to="/settings" className="settings-link" onClick={() => setShowSidebar(false)}>
            ⚙️ 设置
          </Link>
        </div>
      </aside>

      <main className="main-content">
        <header className="chat-header">
          <button className="menu-button" onClick={() => setShowSidebar(true)}>
            ☰
          </button>
          <div className="chat-title">
            {conversationId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Cloud Code Terminal</span>
                {(() => {
                  const conv = conversations.find((c: Conversation) => c.id === conversationId)
                  if (conv) {
                    const isClaude = conv.cliType === 'claude'
                    return (
                      <span 
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: isClaude ? '#fef3c7' : '#dbeafe',
                          color: isClaude ? '#92400e' : '#1e40af',
                          border: `1px solid ${isClaude ? '#fcd34d' : '#93c5fd'}`
                        }}
                      >
                        <span style={{ fontSize: '10px' }}>{isClaude ? 'C' : 'O'}</span>
                        <span>{isClaude ? 'Claude' : 'OpenCode'}</span>
                      </span>
                    )
                  }
                  return null
                })()}
              </div>
            ) : (
              '请选择或创建会话'
            )}
          </div>
        </header>

        {conversationId ? (
          isMobile ? (
            <MobileTerminal conversationId={conversationId} />
          ) : (
            <Terminal conversationId={conversationId} />
          )
        ) : (
          <div className="empty-state">
            <h2>欢迎使用 Cloud Code</h2>
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                marginTop: '20px',
                padding: '14px 28px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: 500,
                minHeight: '48px'
              }}
            >
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
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #ffffff;
        }

        .sidebar {
          width: 260px;
          background: #ffffff;
          border-right: 1px solid #e5e5e5;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 100;
        }

        .sidebar-header {
          padding: 10px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .new-chat-btn {
          flex: 1;
          padding: 12px;
          background: #f7f7f8;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          color: #2e2e2e;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
          min-height: 44px;
        }

        .new-chat-btn:hover {
          background: #e8e8ea;
        }

        .new-chat-btn:active {
          background: #d8d8da;
        }

        .close-sidebar {
          display: none;
          background: none;
          border: none;
          font-size: 18px;
          color: #675676;
          cursor: pointer;
          padding: 8px;
          min-width: 44px;
          min-height: 44px;
        }

        .sidebar-footer {
          padding: 10px;
          border-top: 1px solid #e5e5e5;
        }

        .settings-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          color: #2e2e2e;
          text-decoration: none;
          border-radius: 6px;
          transition: background 0.2s;
          font-size: 14px;
          min-height: 44px;
        }

        .settings-link:hover {
          background: #f7f7f8;
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
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #ffffff;
        }

        .chat-header {
          height: 50px;
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
          min-width: 44px;
          min-height: 44px;
        }

        .chat-title {
          flex: 1;
          font-size: 16px;
          font-weight: 500;
          color: #2e2e2e;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          height: 100%;
          color: #8e8ea0;
          text-align: center;
          padding-top: 20vh;
        }

        .empty-state h2 {
          font-size: 24px;
          margin-bottom: 8px;
          color: #2e2e2e;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: -260px;
            top: 0;
            bottom: 0;
            transition: left 0.3s ease;
            box-shadow: 2px 0 8px rgba(0,0,0,0.1);
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            z-index: 100;
          }

          .sidebar.open {
            left: 0;
            z-index: 200;
          }

          .sidebar-overlay:not(:has(+ .sidebar.open)) {
            display: none !important;
          }

          .sidebar-overlay {
            display: block;
            z-index: 150;
          }

          .close-sidebar {
            display: block;
          }

          .menu-button {
            display: block;
          }

          .chat-header {
            padding-top: max(16px, env(safe-area-inset-top));
          }
        }
      `}</style>
    </div>
  )
}
