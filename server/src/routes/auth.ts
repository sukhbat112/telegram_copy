import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../db'
import { config } from '../config'
import { authenticate } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { asyncHandler } from '../middleware/error'

const router = Router()

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function makeToken(userId: number) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })
}

const registerSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters.').max(30),
  password: z.string().min(6, 'Password must be at least 6 characters.').max(200),
})

// POST /api/auth/register
router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof registerSchema>

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) return res.status(409).json({ error: 'That username is already taken.' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { username, password: passwordHash } })

    res.status(201).json({
      token: makeToken(user.id),
      user: { id: user.id, username: user.username },
    })
  })
)

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// POST /api/auth/login
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>

    const user = await prisma.user.findUnique({ where: { username } })
    // Same error whether the user is missing or the password is wrong, so
    // nobody can probe which usernames exist.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Wrong username or password.' })
    }

    res.json({
      token: makeToken(user.id),
      user: { id: user.id, username: user.username },
    })
  })
)

// GET /api/auth/me — restore a session from a saved token
router.get(
  '/me',
  authenticate,
  asyncHandler(async (_req, res) => {
    const userId = res.locals.userId as number
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({ user })
  })
)

export default router
