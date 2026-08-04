import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

// Express middleware that guards protected routes. It reads the
//   Authorization: Bearer <token>
// header, verifies it, and stashes the user's id in res.locals for the handler.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'You must be logged in.' })
  }

  const token = header.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: number }
    res.locals.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or expired.' })
  }
}
