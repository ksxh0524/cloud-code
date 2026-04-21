import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

const API_KEY = process.env.API_KEY

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next()
    return
  }

  const headerKey = req.headers['x-api-key'] as string | undefined

  const bearerKey = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined

  if (
    (headerKey && safeEqual(headerKey, API_KEY)) ||
    (bearerKey && safeEqual(bearerKey, API_KEY))
  ) {
    next()
    return
  }

  res.status(401).json({ error: 'Unauthorized' })
}

export function validateApiKey(apiKey: string | undefined): boolean {
  if (!API_KEY) return true
  if (!apiKey) return false
  return safeEqual(apiKey, API_KEY)
}
