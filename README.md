# Allo Inventory Reservations

Inventory and reservation demo for multi-warehouse retail and D2C checkout flows.

## Local Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to a hosted PostgreSQL instance.
2. Install dependencies with `npm install`.
3. Apply the initial migration with `npx prisma migrate deploy`.
4. Seed demo data with `npm run prisma:seed`.
5. Start the app with `npm run dev`.

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
- Use Supabase, Neon, or another hosted PostgreSQL provider for `DATABASE_URL`.
- Set `CRON_SECRET` in production and configure the cron job to call the cleanup route.
