import { config, corsOrigins } from './config' // validates env + loads .env FIRST
import { logger } from './logger'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import http from 'http'
import { Server } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'

import { prisma } from './db'
import { redis, connectRedis } from './redis'
import { initSocket } from './socket'
import authRoutes from './routes/auth'
import chatRoutes from './routes/chats'
import userRoutes from './routes/users'
import { errorHandler } from './middleware/error'

async function bootstrap() {
  const app = express()

  // --- Security & core middleware ---
  app.use(helmet()) // sensible security headers
  app.use(cors({ origin: corsOrigins, credentials: true })) // only our client
  app.use(express.json({ limit: '100kb' })) // cap body size
  app.use(pinoHttp({ logger })) // structured request logging

  // Slow down brute-force attacks on the auth endpoints.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  })

  // --- Routes ---
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/api/auth', authLimiter, authRoutes)
  app.use('/api/chats', chatRoutes)
  app.use('/api/users', userRoutes)

  // Central error handler — must be registered last.
  app.use(errorHandler)

  const server = http.createServer(app)
  const io = new Server(server, { cors: { origin: corsOrigins } })

  // --- Realtime scaling: connect Redis and attach the Socket.IO adapter ---
  // The adapter relays events between ALL server instances over Redis pub/sub,
  // so a message emitted on instance A still reaches a user on instance B.
  // This is what lets you run more than one server behind a load balancer.
  await connectRedis()
  const pubClient = createClient({ url: config.REDIS_URL })
  const subClient = pubClient.duplicate()
  pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'))
  subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'))
  await Promise.all([pubClient.connect(), subClient.connect()])
  io.adapter(createAdapter(pubClient, subClient))

  initSocket(io)

  server.listen(config.PORT, () => {
    logger.info(`✅ Server listening on http://localhost:${config.PORT} (${config.NODE_ENV})`)
  })

  // --- Graceful shutdown: stop accepting work, then close connections cleanly ---
  let shuttingDown = false
  async function shutdown(signal: string) {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`${signal} received — shutting down gracefully…`)
    io.close()
    server.close()
    await Promise.allSettled([
      prisma.$disconnect(),
      redis.quit(),
      pubClient.quit(),
      subClient.quit(),
    ])
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal startup error')
  process.exit(1)
})
