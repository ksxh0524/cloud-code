import { logger } from './logger'

/**
 * 带认证和网络日志记录的 fetch 包装器
 *
 * 自动添加 API Key 头，并记录所有网络请求
 */

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const apiKey = localStorage.getItem('api_key')
  const method = init?.method?.toUpperCase() || 'GET'
  const startTime = performance.now()

  // 构建请求配置
  const config: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  }

  logger.debug(`Request ${method} ${url}`, { url, method }, 'network')

  try {
    const response = await window.fetch(input, config)
    const duration = Math.round(performance.now() - startTime)

    // 记录响应
    logger.network(method, url, response.status, duration)

    if (!response.ok) {
      logger.error(`Request failed: ${method} ${url}`, {
        status: response.status,
        statusText: response.statusText,
        duration,
      }, 'network')
    }

    return response
  } catch (error) {
    const duration = Math.round(performance.now() - startTime)
    logger.error(`Request error: ${method} ${url}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    }, 'network')
    throw error
  }
}

/**
 * 简化版本的 fetch（不带认证）
 * 用于不需要 API Key 的请求
 */
export const fetchWithoutAuth = window.fetch.bind(window)
