import { useState, useEffect, useRef, useCallback } from 'react'
import { logger, type LogEntry, type LogLevel } from '../lib/logger'

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

  if (!isOpen) return null

  return (
    <div className="log-viewer-overlay" onClick={onClose}>
      <div className="log-viewer" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="log-viewer-header">
          <h3>系统日志</h3>
          <div className="log-stats">
            <span>总计: {logs.length}</span>
            {filteredLevel !== 'all' && <span>筛选: {filteredLogs.length}</span>}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* 工具栏 */}
        <div className="log-toolbar">
          <div className="filter-group">
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
            className="search-input"
          />

          <label className="auto-scroll-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            自动滚动
          </label>

          <div className="action-buttons">
            <button onClick={() => handleExport('text')} title="导出为文本">
              📄 导出
            </button>
            <button onClick={handleClear} className="danger" title="清空日志">
              🗑️ 清空
            </button>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="log-container" ref={containerRef}>
          {filteredLogs.length === 0 ? (
            <div className="empty-logs">暂无日志</div>
          ) : (
            <>
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`log-entry log-${log.level}`}
                  onClick={() => {
              // Log context available on click - can be expanded for debugging
                  }}
                >
                  <span className="log-time">{formatTime(log.timestamp)}</span>
                  <span className="log-source" title={log.source}>
                    {SOURCE_ICONS[log.source]}
                  </span>
                  <span
                    className="log-level"
                    style={{ color: LOG_LEVEL_COLORS[log.level] }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className="log-message">{log.message}</span>
                  {log.context && (
                    <span className="log-context-hint" title="点击查看详情">
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

      <style>{`
        .log-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .log-viewer {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .log-viewer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e5e5;
          background: #f7f7f8;
        }

        .log-viewer-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #111;
        }

        .log-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #666;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          color: #666;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: #eee;
          color: #111;
        }

        .log-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid #e5e5e5;
          background: #fff;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          gap: 8px;
        }

        .filter-group select {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          background: #fff;
          cursor: pointer;
        }

        .search-input {
          flex: 1;
          min-width: 150px;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
        }

        .auto-scroll-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #555;
          cursor: pointer;
          user-select: none;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .action-buttons button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          background: #fff;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-buttons button:hover {
          background: #f7f7f8;
        }

        .action-buttons button.danger {
          border-color: #fecaca;
          color: #dc2626;
        }

        .action-buttons button.danger:hover {
          background: #fef2f2;
        }

        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 12px 0;
          background: #fafafa;
          font-family: 'SFMono-Regular', 'Menlo', 'Monaco', monospace;
          font-size: 12px;
          line-height: 1.6;
        }

        .empty-logs {
          text-align: center;
          padding: 40px;
          color: #999;
          font-size: 14px;
        }

        .log-entry {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 6px 20px;
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: background 0.1s;
        }

        .log-entry:hover {
          background: #f0f0f0;
        }

        .log-entry.log-error {
          border-left-color: #dc2626;
          background: #fef2f2;
        }

        .log-entry.log-warn {
          border-left-color: #d97706;
          background: #fffbeb;
        }

        .log-entry.log-debug {
          color: #888;
        }

        .log-time {
          color: #999;
          font-size: 11px;
          min-width: 65px;
          flex-shrink: 0;
        }

        .log-source {
          flex-shrink: 0;
          font-size: 12px;
        }

        .log-level {
          font-size: 10px;
          font-weight: 600;
          min-width: 45px;
          flex-shrink: 0;
        }

        .log-message {
          flex: 1;
          word-break: break-word;
          color: #333;
        }

        .log-context-hint {
          color: #999;
          font-size: 10px;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .log-viewer-overlay {
            padding: 0;
          }

          .log-viewer {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .log-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            justify-content: space-between;
          }

          .search-input {
            width: 100%;
          }

          .log-entry {
            padding: 8px 12px;
            flex-wrap: wrap;
          }

          .log-message {
            width: 100%;
            margin-top: 4px;
          }
        }
      `}</style>
    </div>
  )
}

export default LogViewer
