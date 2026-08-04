import pino from 'pino'
import { config } from './config'

// Structured logging. In production we emit JSON (easy for log aggregators to
// parse); in development we pretty-print with colours for readability.
export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    config.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
})
