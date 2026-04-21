import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { authFetch } from '../lib/fetch'

interface WorkDir {
  path: string
  name: string
  isConfig: boolean
}

interface NewConversationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (workDir: string) => void
}

export default function NewConversationModal({ open, onClose, onConfirm }: NewConversationModalProps) {
  const [workDirs, setWorkDirs] = useState<WorkDir[]>([])
  const [selectedDir, setSelectedDir] = useState<string>('')
  const [subDirs, setSubDirs] = useState<string[]>([])
  const [selectedSubDir, setSelectedSubDir] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) { loadWorkDirs() } }, [open])

  const loadWorkDirs = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/workdirs')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setWorkDirs(data)
      const configDir = data.find((d: WorkDir) => d.isConfig)
      if (configDir) { setSelectedDir(configDir.path); loadSubDirs(configDir.path) }
    } catch { setWorkDirs([]) }
    finally { setLoading(false) }
  }

  const loadSubDirs = async (path: string) => {
    try {
      const res = await authFetch(`/api/directories?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Failed')
      setSubDirs(await res.json())
      setSelectedSubDir('')
    } catch { setSubDirs([]) }
  }

  const handleDirChange = (path: string) => { setSelectedDir(path); setSelectedSubDir(''); loadSubDirs(path) }

  const getFinalPath = () => {
    const baseDir = selectedDir.replace(/\/+$/, '')
    return selectedSubDir ? `${baseDir}/${selectedSubDir}` : baseDir
  }

  const handleConfirm = () => {
    const finalPath = getFinalPath()
    if (finalPath) { onConfirm(finalPath); setSelectedDir(''); setSelectedSubDir(''); setSubDirs([]); onClose() }
  }

  const canConfirm = selectedDir && !loading

  return (
    <Modal open={open} onClose={onClose} title="新建对话">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>加载中...</div>
      ) : (
        <>
          <CustomSelect
            label="工作目录"
            value={selectedDir}
            onChange={handleDirChange}
            options={[
              { value: '', label: '请选择工作目录' },
              ...workDirs.map((dir) => ({ value: dir.path, label: `${dir.name} ${dir.isConfig ? '(默认)' : ''}` }))
            ]}
          />
          {subDirs.length > 0 && (
            <CustomSelect
              label="子目录（可选）"
              value={selectedSubDir}
              onChange={setSelectedSubDir}
              options={[{ value: '', label: '使用根目录' }, ...subDirs.map((subDir) => ({ value: subDir, label: subDir }))]}
            />
          )}
          {selectedDir && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#f7f7f8', borderRadius: '8px', fontSize: '13px', color: '#666', wordBreak: 'break-all' }}>
              <div>将使用: <span style={{ color: '#111', fontWeight: 500 }}>{getFinalPath()}</span></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={onClose} style={{ padding: '12px 20px', background: '#f0f0f0', border: '1px solid #e5e5e5', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', color: '#111', minHeight: '44px', flex: 1, minWidth: '100px' }}>取消</button>
            <button onClick={handleConfirm} disabled={!canConfirm} style={{ padding: '12px 20px', background: canConfirm ? '#111' : '#e5e5e5', color: canConfirm ? '#fff' : '#999', border: 'none', borderRadius: '8px', cursor: canConfirm ? 'pointer' : 'not-allowed', fontSize: '15px', minHeight: '44px', flex: 1, minWidth: '100px' }}>创建</button>
          </div>
        </>
      )}
    </Modal>
  )
}
