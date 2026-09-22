# paypilot-api

PayPilot's backend. NestJS + TypeScript + MySQL (Drizzle ORM). Owns all
orchestration between the frontend, WhatsApp reminders (Teekrr), and
payments (Stripe) — none of those provider credentials are ever exposed to
the frontend. Pushing a paid bill's settlement to the biller is currently
simulated; see "Settlement" below.

## Stack

- NestJS 10, TypeScript
- MySQL 8, Drizzle ORM (`drizzle-orm` + `mysql2` driver, `drizzle-kit` for migrations)
- JWT auth (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`), bcrypt password hashing
- `class-validator` / `class-transformer` for request validation and response shaping
- `@nestjs/throttler` for rate limiting, `helmet` for security headers
- `@nestjs/swagger` for OpenAPI docs
- Stripe (`stripe` SDK) for payments, a WhatsApp broadcast provider for reminders

## Prerequisites

- Node.js 20+ (developed against Node 24)
- A running MySQL 8 server
- A Stripe account (test mode is enough) and an approved WhatsApp
  broadcast template from your provider

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
| `JWT_SECRET` | HMAC secret for signing access tokens (also used to sign pay-link tokens — see below) |
| `JWT_EXPIRES_IN` | e.g. `1d` |
| `INTERNAL_API_KEY` | Reserved for protecting internal-only endpoints |
| `STRIPE_SECRET_KEY` | Required. Test-mode secret key from the Stripe Dashboard. |
| `STRIPE_WEBHOOK_SECRET` | Required for `/webhooks/stripe` to process anything. From `stripe listen --forward-to localhost:3000/webhooks/stripe` locally, or the Dashboard's webhook config in production. Fails closed (503) until set. |
| `TEEKRR_BASE_URL` | Required. WhatsApp broadcast provider's API base URL. |
| `TEEKRR_API_KEY` | Required. `Authorization: Bearer <key>` with permission to send WhatsApp messages. |
| `TEEKRR_WHATSAPP_TEMPLATE_NAME` | Required for reminders to send — the name of a pre-approved WhatsApp template. `POST /bills/:id/reminder` fails closed (503) until it's set. |

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

| Table | Purpose |
|---|---|
| `users` | Registered accounts (auth) |
| `billers` | PayPilot's own biller catalogue, including each biller's dynamic bill-entry form schema (`form_schema`) |
| `bills` | A user's connected bill. `dueDayOfMonth` and `lastReminderForDueDate` drive the automated reminder — see below. |
| `payments` | Stripe-linked payment against a bill (`stripePaymentIntentId`, `status`). Created either via the in-app Elements flow (`POST /bills/:id/payments`, returns a `clientSecret`) or the hosted Checkout flow (`POST /bills/:id/payments/checkout-session`, returns a `checkoutUrl`). `billerPushStatus` summarizes the latest settlement attempt; full history lives in `biller_push_attempts`. |
| `biller_push_attempts` | Append-only log of settlement (push-to-biller) attempts per payment, written by `SettlementService` after every Stripe `payment_intent.succeeded` webhook. |
| `reminders` | A scheduled WhatsApp reminder per bill. `externalMessageRef` stores the provider's broadcast id. |

### Due-date automation

A bill's reminder doesn't need to be scheduled manually. `dueDayOfMonth` is
captured at bill registration, and `src/bills/due-date.util.ts` computes the
next occurrence of that day (clamped to the actual days in a given month)
and a reminder date a configurable number of days before it
(`REMINDER_LEAD_DAYS`, default 3).

- **On connect**: `BillsController` schedules the bill's first reminder
  immediately after `POST /bills` succeeds. A scheduling failure (e.g. no
  template configured yet) is logged and doesn't block bill creation — the
  recurring cron below will pick the bill up on its next cycle.
- **Recurring**: `ReminderSchedulerCron` runs daily, sweeps every active
  bill, and schedules a reminder for any bill that's due for one and
  hasn't already gotten one for that specific due date.

### Pay links (`GET /pay/:token`)

A reminder's "Pay Now" WhatsApp button doesn't link to a pre-created Stripe
Checkout Session — those expire within 24 hours, and a reminder can sit
unread in WhatsApp longer than that. Instead, each reminder carries a
signed pay-link token (`PayLinkService`, 30-day TTL, scoped to a specific
bill/user). `GET /pay/:token` verifies the token, creates a **fresh**
Checkout Session on click, and redirects to it — so the link stays valid
for the life of the token, independent of any individual session's
lifetime.

## Module layout

```text
src/
  app.module.ts            # wires everything together
  app.controller.ts        # GET /health
  auth/                    # register, login, JWT strategy/guard
  users/                   # GET /me, user data access
  billers/                 # GET /billers — PayPilot's own catalogue
  bills/                   # POST/GET /bills — connect + list bills, due-date auto-reminder scheduling
  payments/                 # POST /bills/:id/payments(/checkout-session), GET /payments, GET /pay/:token, SettlementService
  reminders/                 # POST /bills/:id/reminder, GET /reminders, recurring due-date cron
  webhooks/                 # POST /webhooks/stripe — signature-verified, fails closed, triggers settlement
  integrations/stripe/      # Stripe client provider
  integrations/teekrr/      # WhatsApp broadcast provider client
  database/                 # Drizzle schema, migrations, connection
  config/                   # env loading + validation
```

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | none | liveness check |
| `POST` | `/auth/register` | none | name, email, mobile, password → creates user + JWT. Rate limited. Rejects duplicate email/mobile with 409. |
| `POST` | `/auth/login` | none | email + password → JWT. Rate limited. |
| `GET` | `/me` | Bearer JWT | current user profile |
| `GET` | `/billers` | Bearer JWT | PayPilot's biller catalogue. `?category=`/`?status=` filters, defaults to `status=active`. |
| `POST` | `/bills` | Bearer JWT | Connect a bill: `billerId`, `billerAccountNumber`, `label`, `estimatedMonthlyAmount`, `dueDayOfMonth`. Auto-schedules the bill's first reminder on success. |
| `GET` | `/bills` | Bearer JWT | List the current user's bills. |
| `POST` | `/bills/:billId/payments` | Bearer JWT | Creates a Stripe PaymentIntent for the bill. Returns `clientSecret` for an in-app Elements checkout. |
| `POST` | `/bills/:billId/payments/checkout-session` | Bearer JWT | Creates a hosted Stripe Checkout Session for the bill. Returns `checkoutUrl`. |
| `GET` | `/pay/:token` | none (signed token) | Public redirect used by the WhatsApp reminder's "Pay Now" button — see "Pay links" above. |
| `GET` | `/payments` | Bearer JWT | Current user's payment history. |
| `POST` | `/webhooks/stripe` | Stripe signature | Handles `payment_intent.succeeded`/`payment_intent.payment_failed`, updates the matching payment, and triggers settlement on success. Fails closed (503) until `STRIPE_WEBHOOK_SECRET` is set. |
| `POST` | `/bills/:billId/reminder` | Bearer JWT | Manually schedules a WhatsApp reminder. In normal operation this happens automatically — see "Due-date automation". |
| `GET` | `/reminders` | Bearer JWT | Current user's scheduled reminders. |

## Testing

```bash
npm run test       # unit tests
npm run test:e2e   # e2e tests (test/jest-e2e.json)
```

No automated test suite has been written yet; verification so far has been
manual.

## Security notes

- Passwords are hashed with bcrypt; no plaintext password is ever stored or logged.
- `password_hash` is stripped from every API response.
- `.env` is git-ignored — only `.env.example` (placeholder values) is tracked.
- The Stripe webhook handler verifies every event's signature before
  processing it, and refuses to process anything if the webhook secret
  isn't configured.
- Pay-link tokens carry their own type marker and can't be interchanged
  with an auth JWT even though both use the same signing secret.
- No settlement-gateway credentials are stored in this repo.
