import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { logger } from '../logger'

// Wrap an async route handler so a thrown/rejected error is passed to Express's
// error handler instead of crashing the process. (Express 4 doesn't catch
// async errors on its own.)
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next)

// The central error handler — registered LAST. Express recognises it as an
// error handler because it takes four arguments. It logs the real error and
// returns a consistent, safe message to the client.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled request error')
  if (res.headersSent) return
  res.status(500).json({ error: 'Something went wrong on the server.' })
}
