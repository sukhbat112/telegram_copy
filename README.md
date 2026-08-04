# Mini Telegram

A small but **production-shaped** realtime chat app — built as a learning project
for full-stack web development, then hardened to resemble a real system.

**Stack:** React + TypeScript (Vite) · Node + Express + TypeScript · Socket.IO ·
**PostgreSQL** (Prisma) · **Redis** (Socket.IO adapter + presence) · Docker · nginx.

> 📐 Read [ARCHITECTURE.md](ARCHITECTURE.md) for how it all fits together, the
> realtime-scaling story, and where something like Kafka would slot in.

## Features

Auth (JWT + bcrypt) · 1:1 and group chats · realtime messaging · group management
(add / leave / members) · typing indicators · online presence · message timestamps.

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres + Redis)

## Project structure

```
telegram-copy/
├── client/            → React frontend (Vite → nginx in prod)
├── server/            → Express + Socket.IO API
│   ├── src/
│   │   ├── config.ts      validated env
│   │   ├── logger.ts      structured logging (pino)
│   │   ├── redis.ts       shared Redis client
│   │   ├── socket.ts      realtime: messages, typing, presence
│   │   ├── index.ts       app wiring + Redis adapter + graceful shutdown
│   │   ├── routes/        auth, chats, users
│   │   └── middleware/    auth, validation, error handling
│   └── prisma/            schema + migrations
├── docker-compose.yml → Postgres + Redis + server + client
└── ARCHITECTURE.md
```

## Getting started

### Option A — run the whole thing in Docker (closest to production)

```bash
docker compose up --build
```

Then open **http://localhost:8080**. The server container automatically applies
database migrations on startup, so this works on the first run.

### Option B — local dev with hot reload (recommended while coding)

Run Postgres + Redis in Docker, and the apps on your machine:

```bash
# 1. start the infrastructure
docker compose up -d db redis

# 2. install dependencies (first time only)
npm install
npm install --prefix server
npm install --prefix client

# 3. create the database tables (first time only)
npm run db:deploy --prefix server

# 4. start server + client with hot reload
npm run dev
```

Open **http://localhost:5173**. Log in as any account you register.

## Environment variables

- **Docker** reads a root `.env` — copy [.env.example](.env.example) to `.env`.
- **Local dev** reads [server/.env](server/.env) (already set to point at the
  Dockerized Postgres/Redis on `localhost`).

The server validates all of these at startup and refuses to boot if any are
missing or malformed (see `server/src/config.ts`).

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Server + client with hot reload (needs infra up) |
| `npm run infra:up` / `infra:down` | Start / stop just Postgres + Redis |
| `npm run docker:up` | Build & run the full stack in containers |
| `npm run db:studio --prefix server` | Visual database browser (Prisma Studio) |
| `npm run db:migrate --prefix server -- --name x` | Create a new migration after editing the schema |

## Build history

Built in phases, from a "hello world" to this:

- [x] **Phase 0** — Skeleton: frontend + backend talking to each other
- [x] **Phase 1** — Auth: register + login (JWT)
- [x] **Phase 2** — Chats + messages over HTTP
- [x] **Phase 3** — Realtime with Socket.IO
- [x] **Phase 4** — Group management (members · add · leave)
- [x] **Phase 5** — Polish: typing indicators, online status, timestamps
- [x] **Production** — Postgres, Redis-scaled realtime, validation, logging, security, Docker

See the end of [ARCHITECTURE.md](ARCHITECTURE.md) for good next study exercises.
