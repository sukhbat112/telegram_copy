import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authenticate } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { asyncHandler } from '../middleware/error'
import { emitToUsers } from '../socket'

const router = Router()

// Every route here requires a logged-in user.
router.use(authenticate)

// --- Helpers ---

async function summarize(chatId: number, meId: number) {
  const chat = await prisma.chat.findUniqueOrThrow({
    where: { id: chatId },
    include: {
      members: { include: { user: { select: { id: true, username: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  const others = chat.members.map((m) => m.user).filter((u) => u.id !== meId)
  const name =
    chat.type === 'group' ? chat.name ?? 'Group' : others[0]?.username ?? 'Unknown'
  const last = chat.messages[0]

  return {
    id: chat.id,
    type: chat.type,
    name,
    members: chat.members.map((m) => m.user),
    lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null,
  }
}

async function isMember(chatId: number, userId: number) {
  const member = await prisma.member.findUnique({
    where: { chatId_userId: { chatId, userId } },
  })
  return Boolean(member)
}

// --- Routes ---

// GET /api/chats — all chats I'm in, most recently active first
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const meId = res.locals.userId as number
    const chats = await prisma.chat.findMany({
      where: { members: { some: { userId: meId } } },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    const summaries = chats.map((chat) => {
      const others = chat.members.map((m) => m.user).filter((u) => u.id !== meId)
      const name =
        chat.type === 'group' ? chat.name ?? 'Group' : others[0]?.username ?? 'Unknown'
      const last = chat.messages[0]
      return {
        id: chat.id,
        type: chat.type,
        name,
        members: chat.members.map((m) => m.user),
        lastMessage: last ? { content: last.content, createdAt: last.createdAt } : null,
        sortAt: last ? last.createdAt : chat.createdAt,
      }
    })

    summaries.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
    res.json({ chats: summaries.map(({ sortAt, ...rest }) => rest) })
  })
)

const createChatSchema = z.object({
  memberIds: z
    .array(z.number().int().positive())
    .min(1, 'Pick at least one person to chat with.'),
  name: z.string().trim().max(60).optional(),
})

// POST /api/chats — start a new chat (1 person => direct, 2+ => group)
router.post(
  '/',
  validateBody(createChatSchema),
  asyncHandler(async (req, res) => {
    const meId = res.locals.userId as number
    const { memberIds, name } = req.body as z.infer<typeof createChatSchema>

    // Clean the list: no duplicates, never myself.
    const others = [...new Set(memberIds)].filter((id) => id !== meId)
    if (others.length === 0) {
      return res.status(400).json({ error: 'Pick someone other than yourself.' })
    }

    const isGroup = others.length > 1
    if (isGroup && (!name || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Group chats need a name.' })
    }

    const found = await prisma.user.findMany({ where: { id: { in: others } } })
    if (found.length !== others.length) {
      return res.status(400).json({ error: 'One or more of those users do not exist.' })
    }

    // For a 1:1 chat, reuse an existing one instead of creating a duplicate.
    if (!isGroup) {
      const existing = await prisma.chat.findFirst({
        where: {
          type: 'direct',
          AND: [
            { members: { some: { userId: meId } } },
            { members: { some: { userId: others[0] } } },
          ],
        },
      })
      if (existing) return res.json({ chat: await summarize(existing.id, meId) })
    }

    const chat = await prisma.chat.create({
      data: {
        type: isGroup ? 'group' : 'direct',
        name: isGroup ? name!.trim() : null,
        members: { create: [meId, ...others].map((userId) => ({ userId })) },
      },
    })

    res.status(201).json({ chat: await summarize(chat.id, meId) })
  })
)

// GET /api/chats/:id/messages — full history (oldest first)
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const meId = res.locals.userId as number
    const chatId = Number(req.params.id)
    if (!Number.isInteger(chatId)) return res.status(400).json({ error: 'Bad chat id.' })
    if (!(await isMember(chatId, meId))) {
      return res.status(403).json({ error: 'You are not in this chat.' })
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, username: true } } },
    })
    res.json({ messages })
  })
)

// NOTE: sending a message happens over the realtime socket (see socket.ts,
// 'message:send'), not a REST route — so it can be pushed to everyone instantly.

const addMembersSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, 'Pick at least one person to add.'),
})

// POST /api/chats/:id/members — add people to a GROUP chat
router.post(
  '/:id/members',
  validateBody(addMembersSchema),
  asyncHandler(async (req, res) => {
    const meId = res.locals.userId as number
    const chatId = Number(req.params.id)
    if (!Number.isInteger(chatId)) return res.status(400).json({ error: 'Bad chat id.' })
    if (!(await isMember(chatId, meId))) {
      return res.status(403).json({ error: 'You are not in this chat.' })
    }

    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) return res.status(404).json({ error: 'Chat not found.' })
    if (chat.type !== 'group') {
      return res.status(400).json({ error: 'You can only add people to group chats.' })
    }

    const { userIds } = req.body as z.infer<typeof addMembersSchema>
    const ids = [...new Set(userIds)]

    const currentMembers = await prisma.member.findMany({
      where: { chatId },
      select: { userId: true },
    })
    const currentIds = new Set(currentMembers.map((m) => m.userId))
    const found = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } })
    const toAdd = found.map((u) => u.id).filter((id) => !currentIds.has(id))

    if (toAdd.length > 0) {
      await prisma.member.createMany({ data: toAdd.map((userId) => ({ chatId, userId })) })
      emitToUsers([...currentIds, ...toAdd], 'chats:changed')
    }

    res.json({ chat: await summarize(chatId, meId) })
  })
)

// POST /api/chats/:id/leave — leave a GROUP chat
router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const meId = res.locals.userId as number
    const chatId = Number(req.params.id)
    if (!Number.isInteger(chatId)) return res.status(400).json({ error: 'Bad chat id.' })

    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) return res.status(404).json({ error: 'Chat not found.' })
    if (chat.type !== 'group') {
      return res.status(400).json({ error: 'You can only leave group chats.' })
    }
    if (!(await isMember(chatId, meId))) {
      return res.status(403).json({ error: 'You are not in this chat.' })
    }

    await prisma.member.delete({ where: { chatId_userId: { chatId, userId: meId } } })

    const remaining = await prisma.member.findMany({ where: { chatId }, select: { userId: true } })
    emitToUsers(remaining.map((m) => m.userId), 'chats:changed')

    res.json({ ok: true })
  })
)

export default router
