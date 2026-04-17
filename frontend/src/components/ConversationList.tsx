import { useState, useEffect } from 'react'
import { Conversation } from '../types'

interface ConversationListProps {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

export default function ConversationList({ conversations, currentId, onSelect, onDelete, onRename }: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const handleRenameStart = (id: string, currentName: string) => {
    setEditingId(id)
    setEditValue(currentName)
    setShowMenu(null)
  }

  const handleRenameSave = (id: string) => {
    if (editValue.trim()) {
      onRename(id, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id)
    setShowDeleteModal(true)
    setShowMenu(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      onDelete(deleteTargetId)
    }
    setShowDeleteModal(false)
    setDeleteTargetId(null)
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showMenu])

  return (
    <div className="conversation-list">
      {/* 删除确认弹窗 */}
      {showDeleteModal && (
        <div className="conv-delete-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="conv-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="conv-delete-header">确认删除</div>
            <div className="conv-delete-body">
              <p>确定要删除这个会话吗？</p>
            </div>
            <div className="conv-delete-actions">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="conv-delete-btn conv-delete-btn-cancel"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="conv-delete-btn conv-delete-btn-confirm"
              >
                删除
              </button>
            </div>
          </div>

          <style>{`
            .conv-delete-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              padding: 16px;
            }

            .conv-delete-dialog {
              background: #ffffff;
              border-radius: 12px;
              padding: 24px;
              min-width: 280px;
              max-width: 90vw;
            }

            .conv-delete-header {
              font-size: 17px;
              font-weight: 600;
              color: #2e2e2e;
              margin-bottom: 16px;
            }

            .conv-delete-body p {
              font-size: 15px;
              color: #8e8ea0;
            }

            .conv-delete-actions {
              display: flex;
              gap: 12px;
              justify-content: flex-end;
              margin-top: 20px;
            }

            .conv-delete-btn {
              padding: 12px 20px;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
              min-height: 48px;
            }

            .conv-delete-btn-cancel {
              background: #f7f7f8;
              border: 1px solid #e5e5e5;
              color: #2e2e2e;
            }

            .conv-delete-btn-cancel:active {
              background: #e8e8ea;
            }

            .conv-delete-btn-confirm {
              background: #ef4444;
              border: none;
              color: #ffffff;
            }

            .conv-delete-btn-confirm:active {
              background: #dc2626;
            }
          `}</style>
        </div>
      )}

      <div className="conversation-items">
        {conversations.length === 0 ? (
          <div className="empty-conversations">
            <p>暂无会话</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentId ? 'active' : ''}`}
            >
              {editingId === conv.id ? (
                <div className="edit-form">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSave(conv.id)
                      } else if (e.key === 'Escape') {
                        setEditingId(null)
                        setEditValue('')
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameSave(conv.id)}
                    className="edit-save"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <>
                  <div className="conversation-info" onClick={() => onSelect(conv.id)}>
                    <div className="conversation-name">
                      {conv.name}
                      <span 
                        className={`cli-badge cli-badge-${conv.cliType}`}
                        title={conv.cliType === 'claude' ? 'Claude Code' : 'OpenCode'}
                      >
                        {conv.cliType === 'claude' ? 'C' : 'O'}
                      </span>
                    </div>
                    <div className="conversation-path">{conv.workDir}</div>
                  </div>
                  <button
                    className="conversation-menu"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(showMenu === conv.id ? null : conv.id)
                    }}
                  >
                    ⋯
                  </button>
                  {showMenu === conv.id && (
                    <div className="conversation-actions">
                      <div
                        className="action-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRenameStart(conv.id, conv.name)
                        }}
                      >
                        重命名
                      </div>
                      <div
                        className="action-item delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(conv.id)
                        }}
                      >
                        删除
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .conversation-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .conversation-items {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .empty-conversations {
          padding: 32px 16px;
          text-align: center;
          color: #8e8ea0;
          font-size: 14px;
        }

        .conversation-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 6px;
          margin-bottom: 4px;
          position: relative;
        }

        .conversation-item:hover {
          background: #f7f7f8;
        }

        .conversation-item.active {
          background: #ececf1;
        }

        .conversation-info {
          flex: 1;
          min-width: 0;
        }

        .conversation-name {
          font-size: 14px;
          font-weight: 500;
          color: #2e2e2e;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cli-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          color: #fff;
        }

        .cli-badge-claude {
          background: #d97706;
        }

        .cli-badge-opencode {
          background: #2563eb;
        }

        .conversation-path {
          font-size: 12px;
          color: #8e8ea0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

.conversation-menu {
          background: none;
          border: none;
          font-size: 16px;
          color: #8e8ea0;
          cursor: pointer;
          padding: 8px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .conversation-item:hover .conversation-menu {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .conversation-menu {
            opacity: 1;
          }
        }

        .conversation-actions {
          position: absolute;
          top: 100%;
          right: 8px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 10;
          min-width: 120px;
        }

        .action-item {
          padding: 12px 16px;
          font-size: 14px;
          color: #2e2e2e;
          cursor: pointer;
          transition: background 0.2s;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .action-item:hover {
          background: #f7f7f8;
        }

        .action-item:active {
          background: #e8e8ea;
        }

        .action-item:first-child {
          border-radius: 6px 6px 0 0;
        }

        .action-item:last-child {
          border-radius: 0 0 6px 6px;
        }

        .action-item.delete {
          color: #ef4444;
        }

        .edit-form {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .edit-form input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-size: 16px;
          outline: none;
          min-height: 44px;
        }

        .edit-form input:focus {
          border-color: #2e2e2e;
        }

        .edit-save {
          background: #2e2e2e;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          min-width: 44px;
          min-height: 44px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-save:active {
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .conversation-menu {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
