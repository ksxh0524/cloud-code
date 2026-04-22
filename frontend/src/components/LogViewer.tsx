import { useState, useEffect, useRef, useCallback } from 'react'
import { logger, type LogEntry, type LogLevel } from '../lib/logger'
import styles from './LogViewer.module.css'

/**
 * 日志查看器组件
 *
 * 提供实时日志查看、筛选、导出功能
 */

interface LogViewerProps {
  isOpen: boolean
  onClose: () => void
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#888',
  info: '#2563eb',
  warn: '#d97706',
  error: '#dc2626',
}

const SOURCE_ICONS: Record<LogEntry['source'], string> = {
  user: '👤',
  system: '⚙️',
  network: '🌐',
  sdk: '🔌',
}

export function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLevel, setFilteredLevel] = useState<LogLevel | 'all'>('all')
  const [filteredSource, setFilteredSource] = useState<LogEntry['source'] | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 订阅日志更新
  useEffect(() => {
    if (!isOpen) return

    // 初始化日志
    setLogs(logger.getLogs())

    // 订阅更新
    const unsubscribe = logger.subscribe(newLogs => {
      setLogs(newLogs)
    })

    return unsubscribe
  }, [isOpen])

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logsEndRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // 筛选日志
  const filteredLogs = logs.filter(log => {
    if (filteredLevel !== 'all' && log.level !== filteredLevel) return false
    if (filteredSource !== 'all' && log.source !== filteredSource) return false
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // 清空日志
  const handleClear = useCallback(() => {
    if (confirm('确定要清空所有日志吗？')) {
      logger.clear()
    }
  }, [])

  // 导出日志
  const handleExport = useCallback((format: 'json' | 'text') => {
    logger.downloadLogs(format)
  }, [])

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Build level class map for dynamic log level styling
  const levelClassMap: Record<string, string | undefined> = {
    error: styles.logError,
    warn: styles.logWarn,
    debug: styles.logDebug,
  }

  if (!isOpen) return null

  return (
    <div className={styles.logViewerOverlay} onClick={onClose}>
      <div className={styles.logViewer} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className={styles.logViewerHeader}>
          <h3>系统日志</h3>
          <div className={styles.logStats}>
            <span>总计: {logs.length}</span>
            {filteredLevel !== 'all' && <span>筛选: {filteredLogs.length}</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 工具栏 */}
        <div className={styles.logToolbar}>
          <div className={styles.filterGroup}>
            <select
              value={filteredLevel}
              onChange={e => setFilteredLevel(e.target.value as LogLevel | 'all')}
            >
              <option value="all">所有级别</option>
              <option value="debug">调试</option>
              <option value="info">信息</option>
              <option value="warn">警告</option>
              <option value="error">错误</option>
            </select>

            <select
              value={filteredSource}
              onChange={e => setFilteredSource(e.target.value as LogEntry['source'] | 'all')}
            >
              <option value="all">所有来源</option>
              <option value="system">系统</option>
              <option value="user">用户</option>
              <option value="network">网络</option>
              <option value="sdk">SDK</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="搜索日志..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <label className={styles.autoScrollLabel}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            自动滚动
          </label>

          <div className={styles.actionButtons}>
            <button onClick={() => handleExport('text')} title="导出为文本">
              📄 导出
            </button>
            <button onClick={handleClear} className={styles.danger} title="清空日志">
              🗑️ 清空
            </button>
          </div>
        </div>

        {/* 日志列表 */}
        <div className={styles.logContainer} ref={containerRef}>
          {filteredLogs.length === 0 ? (
            <div className={styles.emptyLogs}>暂无日志</div>
          ) : (
            <>
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`${styles.logEntry} ${levelClassMap[log.level] || ''}`}
                  onClick={() => {
              // Log context available on click - can be expanded for debugging
                  }}
                >
                  <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                  <span className={styles.logSource} title={log.source}>
                    {SOURCE_ICONS[log.source]}
                  </span>
                  <span
                    className={styles.logLevel}
                    style={{ color: LOG_LEVEL_COLORS[log.level] }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className={styles.logMessage}>{log.message}</span>
                  {log.context && (
                    <span className={styles.logContextHint} title="点击查看详情">
                      📎
                    </span>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default LogViewer
