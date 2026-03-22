import { useState } from 'react'
import { Conversation } from '../../../shared/types'

interface ConversationListProps {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

export default function ConversationList({ conversations, currentId, onSelect, onCreate, onDelete, onRename }: ConversationListProps) {
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

  return (
    <div className="conversation-list">
      {/* 删除确认弹窗 */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">确认删除</div>
            <div className="modal-body">
              <p>确定要删除这个会话吗？</p>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="modal-btn modal-btn-cancel"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="modal-btn modal-btn-confirm"
              >
                删除
              </button>
            </div>
          </div>

          <style>{`
            .modal-overlay {
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
            }

            .modal-content {
              background: #ffffff;
              border-radius: 12px;
              padding: 24px;
              min-width: 320px;
            }

            .modal-header {
              font-size: 16px;
              font-weight: 600;
              color: #2e2e2e;
              margin-bottom: 16px;
            }

            .modal-body p {
              font-size: 14px;
              color: #8e8ea0;
            }

            .modal-actions {
              display: flex;
              gap: 8px;
              justify-content: flex-end;
              margin-top: 16px;
            }

            .modal-btn {
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
            }

            .modal-btn-cancel {
              background: #f7f7f8;
              border: 1px solid #e5e5e5;
              color: #2e2e2e;
            }

            .modal-btn-confirm {
              background: #ef4444;
              border: none;
              color: #ffffff;
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
          padding: 4px 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .conversation-item:hover .conversation-menu {
          opacity: 1;
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
          min-width: 100px;
        }

        .action-item {
          padding: 10px 16px;
          font-size: 14px;
          color: #2e2e2e;
          cursor: pointer;
          transition: background 0.2s;
        }

        .action-item:hover {
          background: #f7f7f8;
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
          padding: 6px 8px;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-size: 14px;
          outline: none;
        }

        .edit-form input:focus {
          border-color: #2e2e2e;
        }

        .edit-save {
          background: #2e2e2e;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 12px;
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
