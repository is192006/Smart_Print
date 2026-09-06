# SmartPrint Backend — Phase 1

Backend foundation and database for SmartPrint, an intelligent college printing
order management system. This phase sets up the project skeleton, the
PostgreSQL schema (via Prisma), and a minimal Express server with a health
check. No business APIs, auth, payments, or queue logic are implemented yet.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL + Prisma ORM

## Prerequisites

- Node.js and npm installed
- PostgreSQL running locally, with a database named `smartprint`

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then edit DATABASE_URL with real credentials
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Verify the server is up:

```bash
curl http://localhost:4000/health
```

> npm 11+ blocks dependency install scripts by default. Prisma needs its
> postinstall/preinstall scripts to download engine binaries, so after
> `npm install` you may need to run `npm install-scripts approve @prisma/client @prisma/engines prisma`
> followed by `npm rebuild` before `prisma generate`/`migrate` will work.
> This project's `package.json` already records the approval (`allowScripts`).

## Environment variables

See `.env.example`:

- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — server port (default 4000)
- `NODE_ENV` — `development` / `production`

## Project structure

```
backend/
├── src/
│   ├── config/       # env loading, shared Prisma client
│   ├── controllers/  # request handlers
│   ├── middleware/   # error handling, 404 handler
│   ├── routes/       # route definitions
│   ├── services/     # business logic (empty in this phase)
│   ├── utils/        # shared helpers (empty in this phase)
│   ├── types/        # shared TypeScript types (empty in this phase)
│   ├── app.ts         # Express app assembly
│   └── server.ts      # entrypoint, DB connect + listen
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── tests/
```

## Notes for later phases

- The printing queue is strictly FIFO, ordered by `Queue.enteredAt`. The
  `queueNumber` field is a human-readable token only and must never be used
  to determine processing order. No priority scoring exists in this schema.
- `OrderDocument.pricePerPage`, `finishingPrice`, and `lineTotal` are
  historical snapshots taken at order-placement time; they must not be
  recomputed from the current `ShopPricingRule` / `ShopFinishingRule` rows.
- Business rule "only one `SUCCESS` payment per order" is not enforced at
  the database level (Prisma's schema DSL does not support partial unique
  indexes on PostgreSQL). Enforce it in the payment service layer when
  payment logic is implemented.
