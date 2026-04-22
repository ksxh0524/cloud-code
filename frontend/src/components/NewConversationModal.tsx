import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { authFetch } from '../lib/fetch'
import { logger } from '../lib/logger'
import styles from './NewConversationModal.module.css'

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
    } catch (err) {
      logger.error('Failed to load work directories', { error: String(err) })
      setWorkDirs([])
    } finally { setLoading(false) }
  }

  const loadSubDirs = async (path: string) => {
    try {
      const res = await authFetch(`/api/directories?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Failed')
      setSubDirs(await res.json())
      setSelectedSubDir('')
    } catch (err) {
      logger.error('Failed to load sub directories', { path, error: String(err) })
      setSubDirs([])
    }
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
        <div className={styles.loading}>加载中...</div>
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
            <div className={styles.pathPreview}>
              <div>将使用: <span className={styles.pathPreviewPath}>{getFinalPath()}</span></div>
            </div>
          )}
          <div className={styles.buttonGroup}>
            <button onClick={onClose} className={styles.cancelButton}>取消</button>
            <button onClick={handleConfirm} disabled={!canConfirm} className={styles.confirmButton}>创建</button>
          </div>
        </>
      )}
    </Modal>
  )
}
