import type { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from './db'
import { redis } from './redis'
import { config } from './config'
import { logger } from './logger'

let ioRef: Server | null = null

// Redis hash mapping userId -> number of live connections. Keeping presence in
// Redis (not process memory) means it stays correct even with MULTIPLE server
// instances behind a load balancer.
const PRESENCE_KEY = 'presence:counts'

// Emit an event to specific users (by id), reaching all their open tabs — and,
// thanks to the Redis adapter, across every server instance.
export function emitToUsers(userIds: number[], event: string, payload?: unknown) {
  if (!ioRef) return
  ioRef.to(userIds.map((id) => `user:${id}`)).emit(event, payload)
}

// Validate socket payloads, same idea as REST body validation.
const sendSchema = z.object({
  chatId: z.number().int().positive(),
  content: z.string().trim().min(1).max(4000),
})
const typingSchema = z.object({ chatId: z.number().int().positive() })

export function initSocket(io: Server) {
  ioRef = io

  // Authenticate every connection with the same JWT as the REST API.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('No token provided'))
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { userId: number }
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as number
    socket.join(`user:${userId}`)

    // Cache the username so typing events don't hit the DB each time.
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    })
    socket.data.username = me?.username ?? 'Someone'

    // --- Presence: mark online (atomic increment in Redis) ---
    try {
      const count = await redis.hIncrBy(PRESENCE_KEY, String(userId), 1)
      if (count === 1) io.emit('presence:update', { userId, online: true })
      const online = (await redis.hKeys(PRESENCE_KEY)).map(Number)
      socket.emit('presence:list', { online })
    } catch (err) {
      logger.error({ err }, 'presence (connect) failed')
    }

    // --- Sending a message ---
    socket.on(
      'message:send',
      async (payload: unknown, ack?: (r: { ok?: true; error?: string }) => void) => {
        const parsed = sendSchema.safeParse(payload)
        if (!parsed.success) return ack?.({ error: 'Invalid message.' })
        const { chatId, content } = parsed.data
        try {
          const membership = await prisma.member.findUnique({
            where: { chatId_userId: { chatId, userId } },
          })
          if (!membership) return ack?.({ error: 'You are not in this chat.' })

          const message = await prisma.message.create({
            data: { chatId, senderId: userId, content },
            include: { sender: { select: { id: true, username: true } } },
          })
          const members = await prisma.member.findMany({
            where: { chatId },
            select: { userId: true },
          })
          io.to(members.map((m) => `user:${m.userId}`)).emit('message:new', { message })
          ack?.({ ok: true })
        } catch (err) {
          logger.error({ err }, 'message:send failed')
          ack?.({ error: 'Could not send the message.' })
        }
      }
    )

    // --- Typing indicators (ephemeral; nothing is stored) ---
    async function relayTyping(payload: unknown, isTyping: boolean) {
      const parsed = typingSchema.safeParse(payload)
      if (!parsed.success) return
      const { chatId } = parsed.data
      try {
        const membership = await prisma.member.findUnique({
          where: { chatId_userId: { chatId, userId } },
        })
        if (!membership) return
        const members = await prisma.member.findMany({
          where: { chatId },
          select: { userId: true },
        })
        const others = members.map((m) => m.userId).filter((id) => id !== userId)
        emitToUsers(others, 'typing:update', {
          chatId,
          userId,
          username: socket.data.username,
          isTyping,
        })
      } catch (err) {
        logger.error({ err }, 'typing relay failed')
      }
    }
    socket.on('typing:start', (p) => relayTyping(p, true))
    socket.on('typing:stop', (p) => relayTyping(p, false))

    // --- Presence: handle disconnect (atomic decrement) ---
    socket.on('disconnect', async () => {
      try {
        const count = await redis.hIncrBy(PRESENCE_KEY, String(userId), -1)
        if (count <= 0) {
          await redis.hDel(PRESENCE_KEY, String(userId))
          io.emit('presence:update', { userId, online: false })
        }
      } catch (err) {
        logger.error({ err }, 'presence (disconnect) failed')
      }
    })
  })
}
