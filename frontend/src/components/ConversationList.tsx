import { useState, useEffect } from 'react'
import { Conversation } from '../types'
import styles from './ConversationList.module.css'

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
    <div className={styles.conversationList}>
      {showDeleteModal && (
        <div className={styles.convDeleteOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.convDeleteDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.convDeleteHeader}>确认删除</div>
            <div className={styles.convDeleteBody}><p>确定要删除这个会话吗？此操作不可撤销。</p></div>
            <div className={styles.convDeleteActions}>
              <button onClick={() => setShowDeleteModal(false)} className={`${styles.convDeleteBtn} ${styles.cancel}`}>取消</button>
              <button onClick={handleDeleteConfirm} className={`${styles.convDeleteBtn} ${styles.confirm}`}>删除</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.convSearch}>
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={styles.convSearchInput}
        />
      </div>

      <div className={styles.convItems} role="listbox" aria-label="对话列表">
        {filtered.length === 0 ? (
          <div className={styles.convEmpty}>
            {searchQuery ? '未找到匹配的对话' : '暂无会话'}
          </div>
        ) : (
          filtered.map(conv => (
            <div
              key={conv.id}
              className={`${styles.convItem} ${conv.id === currentId ? styles.active : ''}`}
              role="option"
              aria-selected={conv.id === currentId}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(conv.id) }
                else if (e.key === 'Delete') { e.preventDefault(); handleDeleteClick(conv.id) }
              }}
            >
              {editingId === conv.id ? (
                <div className={styles.convEdit}>
                  <input
                    type="text" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(conv.id); else if (e.key === 'Escape') { setEditingId(null); setEditValue('') } }}
                    autoFocus className={styles.convEditInput}
                  />
                  <button onClick={() => handleRenameSave(conv.id)} className={styles.convEditSave}>✓</button>
                </div>
              ) : (
                <>
                  <div className={styles.convInfo} onClick={() => onSelect(conv.id)}>
                    <div className={styles.convName}>{conv.name}</div>
                    <div className={styles.convMeta}>
                      <span className={styles.convPath}>{conv.workDir.split('/').filter(Boolean).pop()}</span>
                      <span className={styles.convDot}>·</span>
                      <span className={styles.convTime}>{timeAgo(conv.updatedAt)}</span>
                    </div>
                  </div>
                  <button className={styles.convMenu} onClick={e => { e.stopPropagation(); setShowMenu(showMenu === conv.id ? null : conv.id) }}>⋯</button>
                  {showMenu === conv.id && (
                    <div className={styles.convActions}>
                      <div className={styles.convAction} onClick={e => { e.stopPropagation(); handleRenameStart(conv.id, conv.name) }}>重命名</div>
                      <div className={`${styles.convAction} ${styles.delete}`} onClick={e => { e.stopPropagation(); handleDeleteClick(conv.id) }}>删除</div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
