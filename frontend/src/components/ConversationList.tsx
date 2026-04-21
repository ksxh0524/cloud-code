import { useState, useEffect } from 'react'
import { Conversation } from '../types'

interface ConversationListProps {
  conversations: Conversation[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function ConversationList({ conversations, currentId, onSelect, onDelete, onRename }: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = searchQuery
    ? conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.workDir.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations

  const handleRenameStart = (id: string, currentName: string) => { setEditingId(id); setEditValue(currentName); setShowMenu(null) }
  const handleRenameSave = (id: string) => { if (editValue.trim()) onRename(id, editValue.trim()); setEditingId(null); setEditValue('') }
  const handleDeleteClick = (id: string) => { setDeleteTargetId(id); setShowDeleteModal(true); setShowMenu(null) }
  const handleDeleteConfirm = () => { if (deleteTargetId) onDelete(deleteTargetId); setShowDeleteModal(false); setDeleteTargetId(null) }

  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showMenu])

  return (
    <div className="conversation-list">
      {showDeleteModal && (
        <div className="conv-delete-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="conv-delete-dialog" onClick={e => e.stopPropagation()}>
            <div className="conv-delete-header">确认删除</div>
            <div className="conv-delete-body"><p>确定要删除这个会话吗？此操作不可撤销。</p></div>
            <div className="conv-delete-actions">
              <button onClick={() => setShowDeleteModal(false)} className="conv-delete-btn cancel">取消</button>
              <button onClick={handleDeleteConfirm} className="conv-delete-btn confirm">删除</button>
            </div>
          </div>
        </div>
      )}

      <div className="conv-search">
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="conv-search-input"
        />
      </div>

      <div className="conv-items">
        {filtered.length === 0 ? (
          <div className="conv-empty">
            {searchQuery ? '未找到匹配的对话' : '暂无会话'}
          </div>
        ) : (
          filtered.map(conv => (
            <div key={conv.id} className={`conv-item ${conv.id === currentId ? 'active' : ''}`}>
              {editingId === conv.id ? (
                <div className="conv-edit">
                  <input
                    type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(conv.id); else if (e.key === 'Escape') { setEditingId(null); setEditValue('') } }}
                    autoFocus className="conv-edit-input"
                  />
                  <button onClick={() => handleRenameSave(conv.id)} className="conv-edit-save">✓</button>
                </div>
              ) : (
                <>
                  <div className="conv-info" onClick={() => onSelect(conv.id)}>
                    <div className="conv-name">{conv.name}</div>
                    <div className="conv-meta">
                      <span className="conv-path">{conv.workDir.split('/').filter(Boolean).pop()}</span>
                      <span className="conv-dot">·</span>
                      <span className="conv-time">{timeAgo(conv.updatedAt)}</span>
                    </div>
                  </div>
                  <button className="conv-menu" onClick={e => { e.stopPropagation(); setShowMenu(showMenu === conv.id ? null : conv.id) }}>⋯</button>
                  {showMenu === conv.id && (
                    <div className="conv-actions">
                      <div className="conv-action" onClick={e => { e.stopPropagation(); handleRenameStart(conv.id, conv.name) }}>重命名</div>
                      <div className="conv-action delete" onClick={e => { e.stopPropagation(); handleDeleteClick(conv.id) }}>删除</div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .conversation-list { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .conv-search { padding: 8px 12px; }
        .conv-search-input {
          width: 100%; padding: 10px 12px;
          border: 1px solid #e5e5e5; border-radius: 10px;
          font-size: 16px; outline: none; background: #fff;
          color: #111; min-height: 42px; box-sizing: border-box;
          transition: border-color 0.15s;
          -webkit-appearance: none; appearance: none;
        }
        .conv-search-input:focus { border-color: #999; box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
        .conv-search-input::placeholder { color: #bbb; }
        .conv-items { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
        .conv-empty { padding: 40px 16px; text-align: center; color: #999; font-size: 14px; }
        .conv-item {
          display: flex; align-items: center; padding: 12px;
          cursor: pointer; border-radius: 10px; margin-bottom: 2px;
          position: relative; transition: background 0.15s;
        }
        .conv-item:hover { background: #f0f0f0; }
        .conv-item.active { background: #e8e8e8; }
        .conv-info { flex: 1; min-width: 0; }
        .conv-name {
          font-size: 14px; font-weight: 500; color: #111;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .conv-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
        .conv-path { font-size: 12px; color: #999; }
        .conv-dot { font-size: 10px; color: #ccc; }
        .conv-time { font-size: 12px; color: #bbb; }
        .conv-menu {
          background: none; border: none; font-size: 18px;
          color: #999; cursor: pointer; padding: 6px;
          min-width: 36px; min-height: 36px;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s; border-radius: 8px;
        }
        .conv-item:hover .conv-menu { opacity: 1; }
        .conv-menu:hover { background: #e0e0e0; }
        @media (max-width: 768px) {
          .conv-menu { opacity: 1; min-width: 44px; min-height: 44px; }
        }
        .conv-actions {
          position: absolute; top: 100%; right: 8px;
          background: #fff; border: 1px solid #e5e5e5;
          border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          z-index: 10; min-width: 130px; overflow: hidden;
        }
        .conv-action {
          padding: 12px 16px; font-size: 14px; color: #111;
          cursor: pointer; transition: background 0.15s;
          min-height: 44px; display: flex; align-items: center;
        }
        .conv-action:hover { background: #f7f7f8; }
        .conv-action.delete { color: #dc2626; }
        .conv-action.delete:hover { background: #fef2f2; }
        .conv-edit { display: flex; align-items: center; gap: 8px; width: 100%; }
        .conv-edit-input {
          flex: 1; padding: 8px 10px; border: 1px solid #e5e5e5;
          border-radius: 8px; font-size: 16px; outline: none;
          min-height: 40px; background: #fff; color: #111;
          -webkit-appearance: none; appearance: none;
        }
        .conv-edit-input:focus { border-color: #999; }
        .conv-edit-save {
          background: #111; color: #fff; border: none; border-radius: 8px;
          min-width: 40px; min-height: 40px; cursor: pointer;
          font-size: 14px; display: flex; align-items: center; justify-content: center;
        }
        .conv-delete-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4); display: flex;
          align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
          animation: fade-in 0.15s ease-out;
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .conv-delete-dialog {
          background: #fff; border-radius: 16px; padding: 24px;
          min-width: 300px; max-width: 90vw;
          box-shadow: 0 16px 48px rgba(0,0,0,0.15);
          animation: dialog-in 0.2s ease-out;
        }
        @keyframes dialog-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .conv-delete-header { font-size: 17px; font-weight: 600; color: #111; margin-bottom: 8px; }
        .conv-delete-body p { font-size: 14px; color: #666; line-height: 1.5; }
        .conv-delete-actions { display: flex; gap: 10px; margin-top: 20px; }
        .conv-delete-actions .conv-delete-btn { flex: 1; }
        .conv-delete-btn {
          padding: 12px 20px; border-radius: 10px;
          font-size: 15px; font-weight: 500; cursor: pointer; min-height: 46px;
          transition: all 0.15s;
        }
        .conv-delete-btn.cancel { background: #f5f5f5; border: none; color: #555; }
        .conv-delete-btn.cancel:hover { background: #eee; }
        .conv-delete-btn.confirm { background: #dc2626; border: none; color: #fff; }
        .conv-delete-btn.confirm:hover { background: #b91c1c; }
      `}</style>
    </div>
  )
}
