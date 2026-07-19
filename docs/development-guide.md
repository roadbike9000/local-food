# Development Guide

## Prerequisites

- Node.js **18.17+** (Next 14's floor — not enforced by an `engines` field in `package.json`, so nothing will stop you running an older version, it'll just fail unpredictably)
- npm
- A free [Neon](https://neon.tech) Postgres project (or any Postgres instance)

## Setup

```bash
npm install
cp .env.example .env      # then fill in real values — see below
npm run prisma:migrate    # creates tables from prisma/schema.prisma
npm run db:seed           # inserts 2 sample vendors + products + a pickup slot
npm run dev                # http://localhost:3000
```

### Environment variables (`.env`)

Minimum to boot: `DATABASE_URL` / `DIRECT_URL` (Neon) + Clerk keys. Everything else (Stripe, Twilio, Cloudinary, Sentry) can stay blank for local dev — each `src/lib/*` helper degrades gracefully (Twilio logs instead of sending; Stripe warns and uses a placeholder key) rather than crashing the app.

When adding a **new** env var: update `.env.example` too. Never commit a real value — `.env` is gitignored.

### Testing Stripe locally

Stripe needs a public URL to deliver webhooks to your machine:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. Use test card `4242 4242 4242 4242`, any future expiry/CVC.

## Everyday commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`next/core-web-vitals` config only, no custom rules) |
| `npm run prisma:migrate` | Apply schema changes — **never** `prisma db push` |
| `npm run prisma:studio` | Visual DB browser |
| `npm run db:seed` | Re-seed sample data (safe to re-run — deletes existing rows first) |
| `npm run test:e2e` | Playwright suite (auto-starts `npm run dev` via `webServer` config — don't start the server manually first) |
| `npm run test:e2e:ui` | Playwright's interactive UI runner |

## Testing notes

- **No unit test runner is configured** (no Jest/Vitest) — Playwright E2E is the only test layer. Don't invent unit test files unless explicitly asked to add that infrastructure.
- Tests live flat in `tests/*.spec.ts`, one file per feature area, not mirrored to `src/`.
- Several specs require seeded data (`storefront-cart.spec.ts`, `payment.spec.ts`, `sms.spec.ts` all navigate to the seeded `/vendors/corner-sourdough` route) — run `npm run db:seed` before `test:e2e` if you haven't.
- `payment.spec.ts` self-skips (`test.skip`) if Stripe test keys aren't configured, rather than failing.
- No mocking of Stripe/Clerk/Twilio anywhere — tests hit real dev-mode services or the code's own graceful-degradation paths.
- Assertions target URL/behavior (`toHaveURL(/sign-in/)`), not third-party widget DOM — keeps tests stable across Clerk/Stripe version bumps.

## Code style

- No Prettier config — no repo-wide formatter is enforced; match surrounding style, don't reformat untouched lines.
- ESLint = `next/core-web-vitals` only.
- Absolute imports via `@/*` → `src/*`; never relative `../../lib/...` across the `app`/`components`/`lib` boundary.
- Money is always `*Cents: Int` — format via `formatPrice()` from `@/lib/utils`, never inline.
- One external-service integration = one file in `src/lib/`.
- Route handlers define their Zod schema at the top of the same file, named `{Purpose}Schema` — not centralized.
