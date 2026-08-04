import type { RequestHandler } from 'express'
import { z } from 'zod'

// Express middleware that validates and CLEANS req.body against a zod schema.
// On success it replaces req.body with the parsed (typed) data; on failure it
// returns a 400 with the first problem. Keeps route handlers free of manual
// "typeof x !== 'string'" checks.
export const validateBody =
  (schema: z.ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid input.' })
    }
    req.body = result.data
    next()
  }
