import { createClient } from 'redis'
import { config } from './config'
import { logger } from './logger'

// A shared Redis client for general use — right now, tracking who's online.
// (Socket.IO's cross-server adapter uses its own dedicated pub/sub clients;
// see index.ts.)
export const redis = createClient({ url: config.REDIS_URL })

redis.on('error', (err) => logger.error({ err }, 'Redis client error'))

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect()
}
