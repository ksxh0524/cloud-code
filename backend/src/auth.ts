import type { Request, Response, NextFunction } from 'express'

/**
 * API 密钥（从环境变量读取）
 * 如果未设置，则不启用认证
 */
const API_KEY = process.env.API_KEY

/**
 * Express 中间件：要求 API 密钥认证
 *
 * 支持两种认证方式：
 * 1. Header: `X-API-Key: your-api-key`
 * 2. Bearer Token: `Authorization: Bearer your-api-key`
 *
 * 如果环境变量未设置 API_KEY，则跳过认证（开放访问）
 *
 * @example
 * ```typescript
 * app.use('/api', requireApiKey, router)
 * ```
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @param next - Express 下一个中间件函数
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  // 如果未设置 API_KEY，则跳过认证
  if (!API_KEY) {
    next()
    return
  }

  // 从 Header 获取 API Key
  const headerKey = req.headers['x-api-key'] as string | undefined

  // 从 Authorization Header 获取 Bearer Token
  const bearerKey = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined

  // 验证 API Key
  if (headerKey === API_KEY || bearerKey === API_KEY) {
    next()
    return
  }

  // 认证失败
  res.status(401).json({ error: 'Unauthorized' })
}

/**
 * 验证 API 密钥
 *
 * 用于 WebSocket 连接等非 Express 中间件场景的认证
 *
 * @param apiKey - 要验证的 API 密钥
 * @returns 如果验证通过返回 true，否则返回 false
 *
 * @example
 * ```typescript
 * const isValid = validateApiKey(wsMessage.data.apiKey)
 * if (!isValid) {
 *   ws.close(4001, 'Unauthorized')
 * }
 * ```
 */
export function validateApiKey(apiKey: string | undefined): boolean {
  // 如果未设置 API_KEY，则允许所有请求
  if (!API_KEY) return true
  return apiKey === API_KEY
}
