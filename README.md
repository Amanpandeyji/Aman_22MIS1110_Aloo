# Allo Inventory Reservations

Inventory and reservation demo for multi-warehouse retail and D2C checkout flows.

## Local Setup

1. Copy .env.example to .env and set the database variables.
2. For Neon:
	- DATABASE_URL: use the pooled connection string for app runtime.
	- DIRECT_URL: use the non-pooled direct connection string for Prisma migrations.
3. Install dependencies with npm install.
4. Apply the initial migration with npx prisma migrate deploy.
5. Seed demo data with npm run prisma:seed.
6. Start the app with npm run dev.

## API

- `GET /api/products` returns products with available, reserved, and total units per warehouse.
- `GET /api/warehouses` returns the warehouse directory.
- `POST /api/reservations` creates a reservation and returns `409` when there is not enough available stock.
- `POST /api/reservations/:id/confirm` confirms the hold and returns `410` when the reservation has expired.
- `POST /api/reservations/:id/release` releases the hold early when payment fails or the user cancels.

## Expiry Strategy

Reservations expire after 10 minutes. The app uses two mechanisms:

1. Lazy cleanup on reads and reservation writes so stale holds do not linger in the UI.
2. A cron-safe endpoint at `POST /api/cron/release-expired` that can be called by Vercel Cron in production.

This keeps counts accurate even if the cron job is delayed, while still giving production a deterministic cleanup path.

## Concurrency Model

The reserve path uses a database transaction and a row-level lock on the stock row for the exact product and warehouse. That means simultaneous requests for the last unit serialize at the database level, so exactly one succeeds and the other sees the updated stock and returns `409`.

## Idempotency

The reserve and confirm endpoints accept an `Idempotency-Key` header. The server stores the first response for that operation and key pair, then returns the stored response on retries without repeating the side effect.

## Trade-offs

- Expiry cleanup is intentionally simple and database-driven rather than a separate worker process.
- The demo keeps the domain model focused on reservation flow rather than customer accounts or payments.
- `409` and `410` responses are shown directly in the UI instead of being hidden behind generic error toasts.

## Deployment Notes

- Deploy the app to Vercel.
- For Neon on Vercel:
	- Set DATABASE_URL to Neon pooled URL.
	- Set DIRECT_URL to Neon direct URL.
- Optional Upstash integration variables are UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
- Set `CRON_SECRET` in production and configure the cron job to call the cleanup route.

## Environment variables

Minimum environment variables required to run locally or in production:

- `DATABASE_URL` — your Neon/Supabase pooled connection string used at runtime. If you use a non-default schema include `&schema=allo_inventory` or set the schema in the connection string.
- `DIRECT_URL` — optional direct (non-pooled) connection string for running Prisma migrations (recommended for Neon).
- `UPSTASH_REDIS_REST_URL` — optional Upstash REST URL for Redis features.
- `UPSTASH_REDIS_REST_TOKEN` — optional Upstash REST token.
- `CRON_SECRET` — a secret value used to protect the expiry cron endpoint.

## Run locally (copy/paste)

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
npm ci
```

3. Generate Prisma client and apply migrations (use `DIRECT_URL` for deploy):

```bash
npx prisma generate
npx prisma migrate deploy
```

4. Seed demo data:

```bash
npm run prisma:seed
```

5. Start dev server:

```bash
npm run dev
```

6. For production-like standalone testing (what we use for the built artifact):

```bash
npm run build
npm run start
```

## Vercel deployment notes

- In Vercel, set the same environment variables in Project Settings (both `Preview` and `Production` as appropriate).
- Recommended Install & Build commands (Vercel Project Settings → General → Build & Development Settings):

Install Command:

```
npm ci && npx prisma generate
```

Build Command:

```
npm run build
```

If you want Vercel to run migrations automatically on deploy, add a pre-build step to call `npx prisma migrate deploy`, or run migrations manually before first deploy.

### Cron / expiry

Use Vercel Cron (or any scheduler) to POST to `/api/cron/release-expired` with the `CRON_SECRET` header. The app also performs lazy cleanup during reads and writes so counts remain correct even if the cron job is delayed.

## Final checklist before pushing

- Ensure `.env` is not committed (the repo includes `.env.example`).
- Run `npm run build` locally to confirm the production build succeeds.
- Verify `npm run start` serves the app and `_next/static` assets load.
- Add secrets to Vercel and (optionally) run the first migration against your hosted Postgres before routing traffic.

