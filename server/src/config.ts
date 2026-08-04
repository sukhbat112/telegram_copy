import 'dotenv/config' // load .env before we read any environment variables
import { z } from 'zod'

// Validate and type ALL environment variables in one place. If anything is
// missing or malformed, the app fails fast at startup with a clear message —
// far better than a confusing crash deep in the code later.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // Postgres connection string, e.g. postgresql://user:pass@localhost:5432/app
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Redis connection string, e.g. redis://localhost:6379
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  // Secret used to sign login tokens. Must be long and random in production.
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // Comma-separated list of browser origins allowed to call the API / sockets.
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const config = parsed.data

// The allowed CORS origins as an array (handy for helmet/cors/socket.io).
export const corsOrigins = config.CLIENT_ORIGIN.split(',').map((s) => s.trim())
