import { PrismaClient } from '@prisma/client'

// One shared database client for the whole app.
// Import `prisma` anywhere you need to read/write the database.
export const prisma = new PrismaClient()
