import { Router } from 'express'
import { prisma } from '../db'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/error'

const router = Router()

// Protect every route in this file — you must be logged in.
router.use(authenticate)

// GET /api/users — everyone except me (so I can pick someone to chat with)
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const meId = res.locals.userId as number
    const users = await prisma.user.findMany({
      where: { id: { not: meId } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    })
    res.json({ users })
  })
)

export default router
