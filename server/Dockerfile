# --- Build stage: install everything and compile TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# ^ runs "prisma generate && tsc" (see package.json)

# --- Runtime stage: a lean image that just runs the compiled server ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring over installed deps (incl. the generated Prisma client + CLI),
# the compiled output, and the schema/migrations.
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3001

# Apply any pending DB migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
