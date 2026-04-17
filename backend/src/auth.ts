import type { Request, Response, NextFunction } from 'express'

const API_KEY = process.env.API_KEY

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next()
    return
  }

  const headerKey = req.headers['x-api-key'] as string | undefined
  const bearerKey = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined

  if (headerKey === API_KEY || bearerKey === API_KEY) {
    next()
    return
  }

  res.status(401).json({ error: 'Unauthorized' })
}

export function validateWsApiKey(url: string | undefined): boolean {
  if (!API_KEY) return true
  if (!url) return false
  const match = url.match(/[?&]apiKey=([^&]+)/)
  return match ? match[1] === API_KEY : false
}
