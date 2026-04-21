import pino from 'pino'

/**
 * 全局日志记录器实例
 *
 * 使用 Pino 日志库，支持结构化日志输出。
 * 在非生产环境下使用 pino-pretty 进行美化输出。
 *
 * @example
 * ```typescript
 * import { logger } from './logger.js'
 *
 * logger.info('Application started')
 * logger.error({ err }, 'An error occurred')
 * logger.debug({ data }, 'Debug information')
 * ```
 *
 * 环境变量:
 * - `LOG_LEVEL`: 设置日志级别 (debug, info, warn, error)，默认 'info'
 * - `NODE_ENV`: 设置为 'production' 时禁用美化输出
 */
export const logger = pino({
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
        },
      }
    : undefined,
  level: process.env.LOG_LEVEL || 'info',
})
