/**
 * 前端日志系统
 *
 * 提供分级日志记录、日志持久化和日志导出功能
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  source: 'user' | 'system' | 'network' | 'sdk'
}

interface LoggerOptions {
  maxLogs?: number
  persistToStorage?: boolean
  consoleOutput?: boolean
  minLevel?: LogLevel
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const STORAGE_KEY = 'cloud_code_logs'
const MAX_LOGS_DEFAULT = 1000

/**
 * 前端日志类
 */
class FrontendLogger {
  private logs: LogEntry[] = []
  private options: Required<LoggerOptions>
  private listeners: Set<(logs: LogEntry[]) => void> = new Set()

  constructor(options: LoggerOptions = {}) {
    this.options = {
      maxLogs: options.maxLogs ?? MAX_LOGS_DEFAULT,
      persistToStorage: options.persistToStorage ?? true,
      consoleOutput: options.consoleOutput ?? true,
      minLevel: options.minLevel ?? 'debug',
    }

    this.loadFromStorage()
  }

  private idCounter = 0
  
  /**
   * 生成唯一 ID
   * 使用递增计数器确保同一毫秒内生成的ID唯一
   */
  private generateId(): string {
    return `${Date.now()}-${++this.idCounter}-${Math.random().toString(36).substr(2, 5)}`
  }

  /**
   * 从 localStorage 加载日志
   */
  private loadFromStorage(): void {
    if (!this.options.persistToStorage) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          this.logs = parsed
        } else {
          console.warn('[Logger] Invalid log storage format, resetting')
        }
      }
    } catch (err) {
      console.warn('[Logger] Failed to load logs from storage:', err)
      // 清除可能损坏的数据
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }

  /**
   * 保存日志到 localStorage
   */
  private saveToStorage(): void {
    if (!this.options.persistToStorage) return
    try {
      const logsToSave = this.logs.slice(-Math.min(this.options.maxLogs, 100))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logsToSave))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        // 存储空间不足，尝试保存更少的数据
        try {
          const logsToSave = this.logs.slice(-50)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(logsToSave))
        } catch (innerErr) {
          console.warn('[Logger] Failed to save logs even with reduced size:', innerErr)
        }
      }
    }
  }

  /**
   * 添加日志条目
   */
  private addLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    source: LogEntry['source'] = 'system'
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      source,
    }

    this.logs.push(entry)

    // 限制日志数量
    if (this.logs.length > this.options.maxLogs) {
      this.logs = this.logs.slice(-this.options.maxLogs)
    }

    // 控制台输出
    if (this.options.consoleOutput) {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString()
      const prefix = `[${timestamp}] [${source.toUpperCase()}] [${level.toUpperCase()}]`

      switch (level) {
        case 'debug':
          console.debug(prefix, message, context || '')
          break
        case 'info':
          console.info(prefix, message, context || '')
          break
        case 'warn':
          console.warn(prefix, message, context || '')
          break
        case 'error':
          console.error(prefix, message, context || '')
          break
      }
    }

    // 保存到存储
    this.saveToStorage()

    // 通知监听器
    this.listeners.forEach(listener => listener([...this.logs]))
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.addLog('debug', message, context, source)
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.addLog('info', message, context, source)
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.addLog('warn', message, context, source)
  }

  /**
   * 记录错误日志
   */
  error(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.addLog('error', message, context, source)
  }

  /**
   * 记录用户操作
   */
  userAction(action: string, details?: Record<string, unknown>): void {
    this.info(`User action: ${action}`, details, 'user')
  }

  /**
   * 记录网络请求
   */
  network(method: string, url: string, status?: number, duration?: number): void {
    this.debug(`Network ${method}`, { url, status, duration }, 'network')
  }

  /**
   * 记录 SDK 相关日志
   */
  sdk(message: string, context?: Record<string, unknown>): void {
    this.debug(`SDK: ${message}`, context, 'sdk')
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * 获取指定级别的日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  /**
   * 获取最近 N 条日志
   */
  getRecentLogs(count: number): LogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = []
    this.saveToStorage()
    this.listeners.forEach(listener => listener([]))
  }

  /**
   * 导出日志为 JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * 导出日志为文本
   */
  exportToText(): string {
    return this.logs
      .map(log => {
        const time = new Date(log.timestamp).toISOString()
        const context = log.context ? ` ${JSON.stringify(log.context)}` : ''
        return `[${time}] [${log.source}] [${log.level.toUpperCase()}] ${log.message}${context}`
      })
      .join('\n')
  }

  /**
   * 下载日志文件
   */
  downloadLogs(format: 'json' | 'text' = 'text'): void {
    const content = format === 'json' ? this.exportToJson() : this.exportToText()
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = `cloud-code-logs-${new Date().toISOString().split('T')[0]}.${format}`
      
      // 使用 MouseEvent 代替 click()，更可控
      const event = new MouseEvent('click', {
        bubbles: false,
        cancelable: true,
        view: window
      })
      a.dispatchEvent(event)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * 订阅日志更新
   */
  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/**
 * 全局日志实例
 */
export const logger = new FrontendLogger({
  maxLogs: 1000,
  persistToStorage: true,
  // 在生产环境禁用控制台输出，但保持日志记录功能
  consoleOutput: true,
  minLevel: 'debug',
})

/**
 * React Hook: 使用日志
 */
export function useLogger() {
  return logger
}

export type { LogEntry, LoggerOptions }
