# paypilot-api

PayPilot's backend. NestJS + TypeScript + MySQL (Drizzle ORM). Owns all
orchestration between the frontend and PayHub, Teekrr, and Stripe — none of
those provider credentials are ever exposed to the frontend.

## Stack

- NestJS 10, TypeScript
- MySQL 8, Drizzle ORM (`drizzle-orm` + `mysql2` driver, `drizzle-kit` for migrations)
- JWT auth (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`), bcrypt password hashing
- `class-validator` / `class-transformer` for request validation and response shaping
- `@nestjs/throttler` for rate limiting, `helmet` for security headers
- `@nestjs/swagger` for OpenAPI docs

## Prerequisites

- Node.js 20+ (developed against Node 24)
- A running MySQL 8 server

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values — see below
npm run db:generate    # only needed after changing src/database/schema.ts
npm run db:migrate      # applies migrations in src/database/migrations
npm run start:dev       # http://localhost:3000
```

Swagger UI: `http://localhost:3000/docs`. Health check: `GET /health`.

### Environment variables

| Var | Purpose |
|---|---|
| `PORT` | API port (default 3000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `CORS_ORIGIN` | Exact origin the frontend is served from (must match, e.g. `http://localhost:5173`) |
| `DATABASE_URL` | `mysql://user:pass@host:port/db` |
| `JWT_SECRET` | HMAC secret for signing access tokens |
| `JWT_EXPIRES_IN` | e.g. `1d` |
| `INTERNAL_API_KEY` | Reserved for protecting internal-only endpoints (e.g. the future reminder worker trigger) |
| `PAYHUB_*`, `TEEKRR_*`, `STRIPE_*` | Not yet used — added once those integrations are built |

`CORS_ORIGIN` only accepts one exact origin right now. If your frontend dev
server ends up on a different port than what's in `.env` (Vite auto-picks
the next free port), update `CORS_ORIGIN` and restart the API — otherwise
the browser silently blocks every request and the frontend shows a generic
error.

### Database

Drizzle is schema-first: `src/database/schema.ts` is the source of truth.
After editing it, run `npm run db:generate` to produce a new SQL migration
in `src/database/migrations/`, then `npm run db:migrate` to apply it.
`npm run db:studio` opens Drizzle Studio against the configured database.

## Module layout

```text
src/
  app.module.ts        # wires everything together
  app.controller.ts     # GET /health
  auth/                 # register, login, JWT strategy/guard
  users/                # GET /me, user data access
  database/             # Drizzle schema, migrations, connection
  config/                # env loading + validation
```

`billers/`, `bills/`, `payments/`, `reminders/`, `integrations/{payhub,teekrr,stripe}/`,
and `webhooks/` are not created yet — they land once the PayHub API contract
(auth, biller shape, inquiry, payment submission) is confirmed, per the
project brief's "do not invent PayHub endpoints" rule. Teekrr and Stripe
follow the same rule for their own endpoints/templates.

## API implemented so far

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | none | liveness check |
| `POST` | `/auth/register` | none | name, email, mobile, password → creates user + JWT. Rate limited (5/min). Rejects duplicate email/mobile with 409. |
| `POST` | `/auth/login` | none | email + password → JWT. Rate limited (10/min). |
| `GET` | `/me` | Bearer JWT | current user profile (never returns `password_hash`) |

Everything else in the full spec (`/billers`, `/bills`, `/bills/:id/inquiry`,
`/bills/:id/payments`, `/payments`, `/bills/:id/reminder`,
`/webhooks/stripe`, `/internal/reminders/process`) is `NOT VERIFIED` /
not implemented — those depend on PayHub, Teekrr, and Stripe details that
haven't been provided yet.

## Testing

```bash
npm run test       # unit tests
npm run test:e2e   # e2e tests (test/jest-e2e.json)
```

No test suite has been written yet for the auth flow — it was verified
manually via curl during development (register → login → /me, plus the
duplicate-email, wrong-password, and missing-token error cases).

## Security notes

- Passwords are hashed with bcrypt (12 salt rounds); no plaintext password
  is ever stored or logged.
- `password_hash` is stripped from every API response via `UserResponseDto`
  (`class-transformer`'s `@Exclude`/`@Expose`).
- `.env` is git-ignored. Never commit real secrets — only `.env.example`
  (with placeholder values) is tracked.
- When Stripe/PayHub/Teekrr are added, their secrets follow the same
  pattern: env vars only, server-side only, never returned to the client.
