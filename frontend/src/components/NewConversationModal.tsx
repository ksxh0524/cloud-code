import { useState, useEffect } from 'react'
import Modal from './Modal'

interface CliType {
  type: 'claude' | 'opencode'
  name: string
  description: string
}

interface CliCheckResult {
  installed: boolean
  version?: string
  error?: string
}

interface WorkDir {
  path: string
  name: string
  isConfig: boolean
}

interface NewConversationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (workDir: string, cliType: 'claude' | 'opencode') => void
}

export default function NewConversationModal({ open, onClose, onConfirm }: NewConversationModalProps) {
  const [workDirs, setWorkDirs] = useState<WorkDir[]>([])
  const [selectedDir, setSelectedDir] = useState<string>('')
  const [subDirs, setSubDirs] = useState<string[]>([])
  const [selectedSubDir, setSelectedSubDir] = useState<string>('')
  const [cliTypes, setCliTypes] = useState<CliType[]>([])
  const [selectedCliType, setSelectedCliType] = useState<'claude' | 'opencode'>('claude')
  const [cliStatus, setCliStatus] = useState<Record<string, CliCheckResult>>({})
  const [loading, setLoading] = useState(false)
  const [checkingCli, setCheckingCli] = useState(false)

  // 当弹窗打开时，加载数据
  useEffect(() => {
    if (open) {
      loadWorkDirs()
      loadCliTypes()
    }
  }, [open])

  // 加载 CLI 类型并检查安装状态
  const loadCliTypes = async () => {
    try {
      const res = await fetch('/api/cli-types')
      const types: CliType[] = await res.json()
      setCliTypes(types)
      
      // 检查每个 CLI 的安装状态
      setCheckingCli(true)
      const status: Record<string, CliCheckResult> = {}
      for (const cli of types) {
        try {
          const checkRes = await fetch(`/api/cli-check/${cli.type}`)
          status[cli.type] = await checkRes.json()
        } catch (e) {
          status[cli.type] = { installed: false, error: '检查失败' }
        }
      }
      setCliStatus(status)
      setCheckingCli(false)
      
      // 如果有已安装的 CLI，默认选择第一个
      const installedTypes = types.filter(t => status[t.type]?.installed)
      if (installedTypes.length > 0 && !status[selectedCliType]?.installed) {
        setSelectedCliType(installedTypes[0].type)
      }
    } catch (error) {
      console.error('Failed to load CLI types:', error)
    }
  }

  // 加载工作目录列表
  const loadWorkDirs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workdirs')
      const data = await res.json()
      setWorkDirs(data)
      // 默认选中配置的工作目录
      const configDir = data.find((d: WorkDir) => d.isConfig)
      if (configDir) {
        setSelectedDir(configDir.path)
        loadSubDirs(configDir.path)
      }
    } catch (error) {
      console.error('Failed to load workdirs:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载子目录
  const loadSubDirs = async (path: string) => {
    try {
      const res = await fetch(`/api/directories?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      setSubDirs(data)
      setSelectedSubDir('')
    } catch (error) {
      console.error('Failed to load subdirs:', error)
      setSubDirs([])
    }
  }

  // 当选中的主目录改变时，加载其子目录
  const handleDirChange = (path: string) => {
    setSelectedDir(path)
    setSelectedSubDir('')
    loadSubDirs(path)
  }

  // 获取最终选中的完整路径
  const getFinalPath = () => {
    const baseDir = selectedDir.replace(/\/+$/, '')
    if (selectedSubDir) {
      return `${baseDir}/${selectedSubDir}`
    }
    return baseDir
  }

  const handleConfirm = () => {
    const finalPath = getFinalPath()
    if (finalPath) {
      onConfirm(finalPath, selectedCliType)
      // 重置状态
      setSelectedDir('')
      setSelectedSubDir('')
      setSubDirs([])
      setSelectedCliType('claude')
      onClose()
    }
  }

  const canConfirm = selectedDir && !loading && cliStatus[selectedCliType]?.installed

  return (
    <Modal open={open} onClose={onClose} title="新建对话">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#8e8ea0' }}>
          加载中...
        </div>
      ) : (
        <>
          {/* CLI 类型选择 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#2e2e2e' }}>
              选择 CLI 工具
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cliTypes.map((cli) => {
                const status = cliStatus[cli.type]
                const isSelected = selectedCliType === cli.type
                const isInstalled = status?.installed
                
                return (
                  <div
                    key={cli.type}
                    onClick={() => isInstalled && setSelectedCliType(cli.type)}
                    style={{
                      padding: '12px',
                      border: `2px solid ${isSelected ? '#3b82f6' : isInstalled ? '#e5e5e5' : '#fee2e2'}`,
                      borderRadius: '8px',
                      cursor: isInstalled ? 'pointer' : 'not-allowed',
                      background: isSelected ? '#eff6ff' : isInstalled ? '#fff' : '#fef2f2',
                      opacity: isInstalled ? 1 : 0.6,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: isSelected ? '#2563eb' : '#2e2e2e' }}>
                        {cli.name}
                      </span>
                      {checkingCli ? (
                        <span style={{ fontSize: '12px', color: '#8e8ea0' }}>检查中...</span>
                      ) : isInstalled ? (
                        <span style={{ fontSize: '12px', color: '#10a37f', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>✓</span>
                          <span>{status?.version?.split('\n')[0] || '已安装'}</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>✗</span>
                          <span>未安装</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8e8ea0' }}>
                      {cli.description}
                    </div>
                    {!isInstalled && !checkingCli && (
                      <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                        提示: {cli.type === 'claude' ? '运行 npm install -g @anthropic-ai/claude-code 安装' : '运行 npm install -g opencode 安装'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#2e2e2e' }}>
              工作目录
            </label>
            <select
              value={selectedDir}
              onChange={(e) => handleDirChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">请选择工作目录</option>
              {workDirs.map((dir) => (
                <option key={dir.path} value={dir.path}>
                  {dir.name} {dir.isConfig ? '(默认)' : ''}
                </option>
              ))}
            </select>
          </div>

          {subDirs.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#2e2e2e' }}>
                子目录（可选）
              </label>
              <select
                value={selectedSubDir}
                onChange={(e) => setSelectedSubDir(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="">使用根目录</option>
                {subDirs.map((subDir) => (
                  <option key={subDir} value={subDir}>
                    {subDir}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDir && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#f7f7f8', borderRadius: '8px', fontSize: '13px', color: '#8e8ea0' }}>
              将使用: <span style={{ color: '#2e2e2e', fontWeight: 500 }}>{getFinalPath()}</span>
              <br />
              CLI: <span style={{ color: '#2e2e2e', fontWeight: 500 }}>{cliTypes.find(c => c.type === selectedCliType)?.name || selectedCliType}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#f7f7f8',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#2e2e2e'
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{
                padding: '10px 20px',
                background: canConfirm ? '#2e2e2e' : '#e5e5e5',
                color: canConfirm ? '#fff' : '#8e8ea0',
                border: 'none',
                borderRadius: '8px',
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              创建
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
