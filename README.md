# paypilot-api

PayPilot's backend. NestJS + TypeScript + MySQL (Drizzle ORM). Owns all
orchestration between the frontend, Teekrr, and Stripe — none of those
provider credentials are ever exposed to the frontend. The push-to-biller
settlement step is mocked (see below); no settlement gateway is wired in.

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
| `STRIPE_SECRET_KEY` | Required. Test-mode secret/restricted key from the Stripe Dashboard. |
| `STRIPE_WEBHOOK_SECRET` | Optional for now — from `stripe listen --forward-to localhost:3000/webhooks/stripe` locally, or the Dashboard's webhook config in production. `POST /webhooks/stripe` fails closed (503) with no processing of any event until this is set — there's no way to verify an unsigned request actually came from Stripe. |
| `TEEKRR_BASE_URL` | Required. Teekrr API base URL, e.g. `https://staging-api.teekrr.com`. |
| `TEEKRR_API_KEY` | Required. `Authorization: Bearer <key>` — the key needs the `send_whatsapp` permission on Teekrr's side. |
| `TEEKRR_WHATSAPP_TEMPLATE_NAME` | Optional for now — the name of a pre-approved WhatsApp template from the Teekrr dashboard. There's no API-key-reachable endpoint to list or create templates, so this can't be discovered or set programmatically. `POST /bills/:id/reminder` fails closed (503) until it's set. |

There is no settlement-gateway env var. Two real gateways were evaluated
(PayHub/Novatti/ATX and IIMMPACT) and neither is wired in — see
`SettlementService` below for why.

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

Tables defined so far:

| Table | Purpose |
|---|---|
| `users` | Registered accounts (auth) |
| `billers` | PayPilot's own biller catalogue — not a proxy of MyPay's PayHub. Seeded from the real biller list, active only, MPKB excluded (60 rows: 31 council, 16 water, 9 telco, 4 electricity), including each biller's dynamic bill-entry form schema (`form_schema`). `logo_url` was not carried over (MyPay's paths point at its own asset host) and is null until PayPilot has its own logo assets. |
| `bills` | A user's connected bill. `billerId` is a real FK into `billers`. There's no bill-inquiry step; `estimatedMonthlyAmount` is entered by the user at registration. |
| `payments` | Stripe-linked payment against a bill (`stripePaymentIntentId`, `status`). `billerPushStatus` is a summary of the latest settlement attempt; full history lives in `biller_push_attempts`. |
| `biller_push_attempts` | Append-only log of settlement (push-to-biller) attempts per payment — request/response payloads, result code/description. Written by `SettlementService` after every Stripe `payment_intent.succeeded` webhook. **Every row is currently mocked** (`resultCode: "MOCKED"`, `requestPayload.mocked: true`) — see below. |
| `reminders` | A scheduled WhatsApp reminder per bill, sent via Teekrr. `externalMessageRef` stores Teekrr's `broadcastUuid`. |

**Settlement (push-to-biller) is mocked, not wired to a real gateway.**
Two real gateways were investigated for this: **PayHub** (the Novatti/ATX
SOAP gateway MyPay's own PayHub feature uses — same `terminalId`/`authKey`
as `mypay-api`'s hardcoded values) turned out to have its agent account
**locked** on ATX's side (`resultCode 4044 — "Agent Locked"`, confirmed
live, reproduced with two different auth keys); **IIMMPACT**
(`docs.iimmpact.com`) was reviewed next — a real HMAC-signed REST API with
a documented `POST /v2/topup` contract — but no credentials for it exist
yet. Rather than block the rest of the demo on either, `SettlementService`
now always simulates success: it still does the real work of loading the
bill's `billerAccountNumber` and the biller's `productCode` and writes a
real `biller_push_attempts` row, it just never calls out to a gateway.
Swapping in a real client later is a single change inside
`SettlementService.settle()` — everything around it (Stripe webhook
trigger, the attempts table, the `billerPushStatus` summary field) is
unaffected either way.

## Module layout

```text
src/
  app.module.ts            # wires everything together
  app.controller.ts        # GET /health
  auth/                    # register, login, JWT strategy/guard
  users/                   # GET /me, user data access
  billers/                 # GET /billers — PayPilot's own catalogue
  bills/                   # POST/GET /bills — connect and list bills
  payments/                 # POST /bills/:id/payments, GET /payments, SettlementService (mocked)
  reminders/                 # POST /bills/:id/reminder, GET /reminders — Teekrr WhatsApp reminders
  webhooks/                 # POST /webhooks/stripe — signature-verified, fails closed, triggers settlement
  integrations/stripe/      # Stripe client provider (STRIPE_CLIENT)
  integrations/teekrr/      # Teekrr HTTP client (TeekrrClient)
  database/                 # Drizzle schema, migrations, connection
  config/                   # env loading + validation
```

## API implemented so far

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | none | liveness check |
| `POST` | `/auth/register` | none | name, email, mobile, password → creates user + JWT. Rate limited (5/min). Rejects duplicate email/mobile with 409. |
| `POST` | `/auth/login` | none | email + password → JWT. Rate limited (10/min). |
| `GET` | `/me` | Bearer JWT | current user profile (never returns `password_hash`) |
| `GET` | `/billers` | Bearer JWT | PayPilot's own catalogue. `?category=`/`?status=` filters, defaults to `status=active`. |
| `POST` | `/bills` | Bearer JWT | Connect a bill: `billerId`, `billerAccountNumber`, `label`, `estimatedMonthlyAmount`. 404 if `billerId` doesn't exist. |
| `GET` | `/bills` | Bearer JWT | List the current user's bills, with biller name/category/productCode joined in. |
| `POST` | `/bills/:billId/payments` | Bearer JWT | Creates a Stripe PaymentIntent for the bill (defaults to `estimatedMonthlyAmount`, or pass `amount` to override). Returns `clientSecret` for the frontend to confirm with Stripe.js. 404 if the bill isn't the caller's. |
| `GET` | `/payments` | Bearer JWT | Current user's payment history. |
| `POST` | `/webhooks/stripe` | Stripe signature | Handles `payment_intent.succeeded`/`payment_intent.payment_failed`, updates the matching `payments` row. On success, also calls `SettlementService.settle()`, which **mocks** a push to the biller (see above) — failures there are logged, never thrown, so the webhook still 200s. **Fails closed (503) on every event** until `STRIPE_WEBHOOK_SECRET` is set — there's no `stripe listen` session running yet, so the webhook itself is unverified end to end (the settlement call it triggers *was* verified directly — see Testing). |
| `POST` | `/bills/:billId/reminder` | Bearer JWT | Schedules a WhatsApp reminder via Teekrr (`type: "schedule broadcast"`): `scheduledFor` (ISO datetime), optional `templateParams` for the template's placeholders. Sends to the caller's own `users.mobile`. 404 if the bill isn't the caller's. **Fails closed (503)** until `TEEKRR_WHATSAPP_TEMPLATE_NAME` is set — there is no approved template yet and no API to discover or create one. |
| `GET` | `/reminders` | Bearer JWT | Current user's scheduled reminders. |

There is no separate settlement endpoint — `SettlementService.settle(paymentId)`
is internal, only called from the Stripe webhook. `POST /bills/:id/inquiry`
was never implemented (not needed — no bill-inquiry step in this flow) and
`/internal/reminders/process` wasn't either (not needed — Teekrr's own
`scheduler-lambda` fires the reminder at `scheduledAt`; PayPilot doesn't
run its own cron for this).

## Testing

```bash
npm run test       # unit tests
npm run test:e2e   # e2e tests (test/jest-e2e.json)
```

No automated test suite has been written yet — auth, billers, bills,
payments, and reminders were all verified manually via curl during
development:
- register → login → /me; billers list + category filter; bill creation
  with a 404 on an unknown `billerId`.
- PaymentIntent creation verified against Stripe's own API afterward,
  confirming amount/currency/metadata matched; `/webhooks/stripe`
  confirmed to fail closed (503) with no `STRIPE_WEBHOOK_SECRET`
  configured. Test PaymentIntents were canceled afterward, not left
  dangling in the Stripe dashboard.
- Reminders: confirmed the real contract by reading `~/Sites/Teekrr/teekrr-api`
  source directly (routes/validators, not docs) and verified the provided
  staging API key against `https://staging-api.teekrr.com` with the
  side-effect-free `POST /broadcasts/validate` endpoint. Confirmed
  `POST /bills/:id/reminder` fails closed (503) with no template
  configured, and separately proved the full request reaches Teekrr
  correctly by pointing `TEEKRR_WHATSAPP_TEMPLATE_NAME` at a name
  guaranteed not to exist — Teekrr rejected it with 400 "WhatsApp template
  not found" *before* anything could be queued, then the env var was
  reverted. **No real WhatsApp message was ever sent** — Teekrr's own
  CLAUDE.md warns staging is live shared infrastructure with no dry-run
  switch, and there's no approved template name to send with yet anyway.
- Settlement: `SettlementService.settle()` was run directly against a real
  `payments` row and confirmed to correctly load the bill's
  `billerAccountNumber` and the biller's `productCode` from the DB, write
  a `biller_push_attempts` row (`resultCode: "MOCKED"`,
  `requestPayload.mocked: true`), and set `payments.billerPushStatus` to
  `success` — all without calling any external API. Before landing on the
  mock: PayHub's real SOAP contract was ported from MyPay's own
  `payhub_helper.php` and confirmed live against
  `https://apistage.atx.my:9007/agent` (safe, read-only) — the agent
  account came back `resultCode 4044 — "Agent Locked"`, reproduced with
  two different auth keys, so no real settlement was ever possible through
  it. IIMMPACT (`docs.iimmpact.com`) was reviewed as an alternative — full
  HMAC-SHA256-signed contract for `GET /v2/catalog`, `GET
  /v2/bill-presentment`, and `POST /v2/topup` — but no credentials for it
  were provided, so no client was built against it; building one without
  ever being able to authenticate would mean shipping unverified guesses
  about a real financial API, which is exactly what this project has
  avoided everywhere else.

## Security notes

- Passwords are hashed with bcrypt (12 salt rounds); no plaintext password
  is ever stored or logged.
- `password_hash` is stripped from every API response via `UserResponseDto`
  (`class-transformer`'s `@Exclude`/`@Expose`).
- `.env` is git-ignored. Never commit real secrets — only `.env.example`
  (with placeholder values) is tracked.
- `STRIPE_SECRET_KEY` currently holds a **test-mode** restricted key
  (`rk_test_...`) for local dev only; it's due for rotation, and a
  production key must never go in `.env` — use a proper secrets manager
  when this ships.
- The Stripe webhook handler verifies every event's signature against
  `STRIPE_WEBHOOK_SECRET` before processing it, and refuses to process
  anything (503) if that secret isn't configured — there's no code path
  that trusts an unsigned webhook body.
- `TEEKRR_API_KEY` is a real staging key for local dev only, scoped to
  whatever permissions were granted on Teekrr's side (`send_whatsapp`
  confirmed). Same rule as Stripe: never a production key in `.env`.
- No settlement-gateway credentials are stored anywhere in this repo —
  the PayHub credentials that were briefly tried (same shared account
  `mypay-api` uses) were removed along with the client code once
  settlement was mocked instead.
