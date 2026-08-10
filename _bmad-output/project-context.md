---
project_name: 'local-food'
user_name: 'Jeff'
date: '2026-07-19'
sections_completed: ['technology_stack', 'language_specific', 'framework_specific', 'testing', 'code_quality', 'workflow', 'dont_miss']
status: 'complete'
rule_count: 45
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Next.js 14.2.13 — **App Router only** (no Pages Router patterns: no `pages/api/*`, no `getServerSideProps`)
- TypeScript (strict), React 18.3.1
- Node 18.17+ required (Next 14 floor — not enforced by an `engines` field, so don't assume otherwise)
- Prisma 5.20 + PostgreSQL (Neon) — `DIRECT_URL` for migrations (unpooled), `DATABASE_URL` (pooled) for the app client. Always `npm run prisma:migrate`, never `prisma db push`
- Clerk 5.7 (auth) — new protected routes must be added to `middleware.ts`'s `isProtectedRoute` matcher or they ship unprotected
- Stripe 16.12 — **hosted Checkout only**, never Elements/PaymentIntents (keeps the app out of PCI scope). Webhook route reads raw `.text()` body — never `.json()` before `constructEvent`, or signature verification breaks. Webhook is not idempotency-guarded beyond `smsNotified` — don't assume replay-safety when extending it
- Twilio 5.3 — `sendSms` failures must not silently set `smsNotified: true`
- Cloudinary 2.5, Sentry 8.30
- Zod 3.23 — v3 API only, don't use v4-only syntax (e.g. top-level `z.email()`)
- Playwright 1.47 (e2e only, no unit test runner)
- Path alias `@/*` → `src/*`

**Known unenforced boundaries** (no validation exists yet — don't assume there is):
- `priceCents`/`totalCents` are 32-bit `Int` (~$21.4M ceiling) — no overflow check
- Checkout `items` array and `quantity` have a floor (`min(1)`, `positive()`) but no ceiling
- `PickupSlot.capacity` and `Vendor.slug` have no uniqueness/collision handling beyond the DB constraint — duplicate slugs throw raw Prisma errors, not friendly ones

## Critical Implementation Rules

### Language-Specific Rules

- Absolute imports only via `@/*` alias (`@/lib/prisma`, `@/lib/stripe`) — never relative `../../lib/...` across `app`/`components`/`lib` boundaries
- `strict: true` — no implicit `any`; new code must type all function params/returns
- Async error handling follows two patterns depending on trust boundary:
  - Untrusted input (request bodies): `req.json().catch(() => null)` then Zod `safeParse` — never a bare `try/catch` around parsing
  - Trusted/expected failures (Stripe signature check): `try/catch` with `err instanceof Error` narrowing before reading `.message`
- No `throw` in server helpers meant to express "absence" (e.g. `getCurrentVendor()` returns `null`, not throw) — reserve throws for actual unexpected failures
- File-header block comment states the route/module's contract (what it does, what it must/must not do) — not per-function JSDoc

### Framework-Specific Rules

- Server Components are the default — pages fetch data directly with `await prisma.*` in the component body (see `vendors/[slug]/page.tsx`). Add `"use client"` only when the component needs state/effects/browser APIs
- `"use client"` boundary is currently just `CartProvider` + `Navbar` — don't push server-only work (Prisma calls, secrets) across it
- Dynamic route params (`params.slug`) come in already typed from the folder name — don't re-validate with Zod, that's for request bodies only
- Missing DB row → call `notFound()` from `next/navigation`, don't return a custom 404 JSX or throw
- Cart is single-vendor by design (`CartProvider.tsx`) — adding an item from a different vendor **replaces** the cart, it doesn't merge. Don't "fix" this as a bug
- Providers (`ClerkProvider`, `CartProvider`) live in root `layout.tsx`, wrapping everything — new app-wide providers go here, not in individual pages
- Tailwind only — no CSS modules/styled-components; utility classes inline in JSX (e.g. `className="mt-1 text-stone-600"`)
- `middleware.ts` lives in `src/` (`src/middleware.ts`), not the project root — this app uses the `src/` directory convention, and Next.js/Clerk won't detect middleware placed at the root. A root-level copy previously caused `auth()` to fail silently on `/dashboard`; don't reintroduce one

### Testing Rules

- Playwright for e2e/API-level specs, Vitest for unit tests (added 2026-08-09) — the two are kept fully separate (see below), never both scanning the same files
- E2E tests live flat in `tests/*.spec.ts`, one file per feature area (`auth`, `payment`, `sms`, `dashboard`, `homepage`, `storefront-cart`, `checkout-api`, `webhooks`) — not mirrored to `src/` structure. `tests/helpers/` holds shared Prisma/Stripe-webhook test utilities
- Unit tests are co-located next to their source as `src/**/*.test.ts` (e.g. `src/lib/utils.test.ts`) — reserved for pure functions/helpers (formatting, message builders); anything needing Prisma/Clerk/a running server belongs in the Playwright suite instead. `vitest.config.mts` scopes Vitest to `src/**/*.test.ts` only, so it never touches `tests/`; Playwright's `testDir` is `./tests` only, so it never touches `src/`. Run with `npm run test:unit`
- Tests assume seeded data exists (`npm run db:seed`) — e.g. `payment.spec.ts` navigates to `/vendors/corner-sourdough`, a seeded vendor slug
- No mocking of Stripe/Clerk/Twilio — tests hit real dev-mode services and gracefully `test.skip()` when required env keys aren't configured (see `payment.spec.ts`), rather than mocking the response
- Assert on URL/behavior, not third-party widget internals — e.g. auth test checks `toHaveURL(/sign-in/)`, not Clerk's form DOM (survives Clerk version bumps)
- `webServer` in `playwright.config.ts` auto-starts `npm run dev` — don't tell the user to manually start the server before running `test:e2e`

### Code Quality & Style Rules

- No Prettier config — no repo-wide formatter enforced; match surrounding code style, don't reformat untouched lines
- ESLint = `next/core-web-vitals` only — CI runs `npm run typecheck` then `npm run lint`, both must pass before tests run
- Naming: camelCase for vars/functions, PascalCase for components/types (`ProductCard`, `CartItem`), one component per file matching filename
- Money is always `*Cents: Int`, never a float — `formatPrice()` in `src/lib/utils.ts` is the only place cents-to-dollar-string conversion happens; don't reimplement it inline
- `src/lib/` = one file per external service (`stripe.ts`, `twilio.ts`, `cloudinary.ts`, `prisma.ts`) — new third-party integrations get their own `lib` file, not inlined in a route
- Route handlers validate with Zod schema defined at the top of the file, named `{Purpose}Schema` (e.g. `CheckoutSchema`) — keep schema colocated with its route, don't centralize into a shared schemas file

### Development Workflow Rules

- No enforced branch/commit naming convention in this repo — default to short, imperative-mood commit messages if none is given
- CI (`.github/workflows/ci.yml`) gates on: `prisma generate` → `typecheck` → `lint` → Playwright e2e, in that order, on every push/PR to `main`. A change that fails any earlier step never reaches the e2e run
- CI provides Postgres/Clerk/Stripe secrets via GitHub Actions secrets — never hardcode a key/URL to make CI pass locally
- `.env` holds real secrets and is gitignored; `.env.example` is the template — when adding a new env var, update `.env.example` too, never commit the real value
- No Vercel/deploy config checked in beyond `.vercel` being gitignored — deployment is assumed to be Vercel but not configured in-repo

### Critical Don't-Miss Rules

- **Never trust client-sent prices.** `/api/checkout` re-fetches products from the DB and computes `totalCents` server-side — any new payment path must do the same, never accept a total or price from the request body
- **Never JSON-parse the Stripe webhook body** before `stripe.webhooks.constructEvent` — signature verification needs the raw string; parsing first breaks it silently (wrong error, not an obvious one)
- **Vendor/product/order queries must scope by ownership.** Dashboard routes should filter by the signed-in vendor (`getCurrentVendor()`), not by an ID passed in from the client — otherwise one vendor can read/edit another's data
- **`isAvailable: false` products must be excluded** from storefront listings and checkout — checkout already re-checks this (`isAvailable: true` in the `findMany`); any new product query path must too
- **Secrets only ever live in `src/lib/*` modules or server-side code** (route handlers, server components) — never in a `"use client"` file or exposed via a `NEXT_PUBLIC_*` var unless it's genuinely meant to be public (e.g. Clerk's publishable key)
- **SMS is one-shot per order** via the `smsNotified` flag — don't add a second send path that skips checking/setting it, or customers get double-texted

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-07-19
