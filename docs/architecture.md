# Architecture — Local Food

## Executive summary

Single Next.js 14 App Router monolith: one codebase, one deploy unit, serving both server-rendered pages and API routes. Server Components fetch data directly from Postgres via Prisma in the component body — there is no separate API layer between pages and the database for read paths. A thin client-side boundary (`CartProvider` + `Navbar` + a few interactive components) handles the only state that needs to survive across pages without a round-trip. External services (Stripe, Twilio, Clerk, Cloudinary, Sentry) are each isolated behind one file in `src/lib/`.

## Technology stack

See [Project Overview](./project-overview.md#tech-stack-summary) for the full table. Architecturally significant choices:
- **Hosted Stripe Checkout, not Elements/PaymentIntents** — keeps the app out of PCI scope entirely; no card data ever reaches this codebase.
- **Server Components as default** — minimizes client JS and keeps secrets (Prisma client, Stripe secret key) off the browser bundle by construction, not by discipline alone.
- **Money as integer cents everywhere** — avoids float rounding; the tradeoff is a hard ceiling at ~$21.4M per line (32-bit `Int`, unenforced).

## Architecture pattern

Layered monolith:

```
Browser
  │
  ├─ Server Components (pages)  ──► Prisma ──► Postgres          [read path]
  │
  ├─ Client Components (cart/nav) ──► fetch() ──► API routes      [write path]
  │                                                  │
  │                                                  ├─► Prisma ──► Postgres
  │                                                  ├─► Stripe (Checkout session)
  │                                                  └─► Twilio (SMS, post-webhook)
  │
  └─ Clerk middleware (edge)  — gates /dashboard(.*) before any of the above runs
```

There is no service layer, no repository pattern, no DTO mapping — route handlers and Server Components call `prisma.*` directly. This is appropriate at current scale; introducing an abstraction layer here would be premature (project convention: avoid unneeded indirection).

## Data architecture

See [Data Models](./data-models.md) for full schema. Five tables (`Vendor`, `Product`, `PickupSlot`, `Order`, `OrderItem`) plus an `OrderStatus` enum. Every child table carries an indexed `vendorId` (or reaches it transitively) — vendor-scoping is the primary access-control mechanism: dashboard queries filter `where: { vendorId: vendor.id }` rather than trusting any client-supplied ID.

## API design

See [API Contracts](./api-contracts.md). Five route handlers: one public (`checkout`), two vendor-scoped pairs (`products`, `pickup-slots`), one webhook (`webhooks/stripe`). No shared response envelope, no API versioning, no OpenAPI/GraphQL schema — plain REST-ish JSON, contracts enforced per-route by inline Zod schemas.

## Component overview

See [Component Inventory](./component-inventory.md). Four components total; the `"use client"` boundary is deliberately minimal (`CartProvider`, `Navbar`, `ProductCard`) — new features should extend this boundary only when they genuinely need browser state/effects, not by default.

## Source tree

See [Source Tree Analysis](./source-tree-analysis.md) for the fully annotated tree.

## Development workflow

See [Development Guide](./development-guide.md).

## Deployment architecture

See [Deployment Guide](./deployment-guide.md) — no deployment config is checked into the repo; CI covers typecheck/lint/e2e only, no migrate-and-deploy step exists yet.

## Testing strategy

Playwright E2E only, no unit test runner. Tests hit real dev-mode services (no mocking) and self-skip when a required integration isn't configured, rather than mocking around it. This means test coverage is behavior/routing-level (e.g., "unauthenticated dashboard visit redirects to sign-in") rather than logic-level (no direct test of `formatPrice` or the checkout price-recomputation logic in isolation).

## Architecturally significant risks (as found, not yet fixed)

1. **Unenforced `PickupSlot.capacity`** — displayed but never checked against booking count.
2. **No idempotency on the Stripe webhook beyond `smsNotified`** — a redelivered event re-runs the `Order` update (harmless) but there's no general event-dedup.
3. **Cart is in-memory only** — a page refresh during checkout loses the cart (though the in-flight `Order` + Stripe session already exist server-side by that point).
4. **`priceCents`/`totalCents` 32-bit ceiling** — fine at current scale, would silently misbehave on very large carts/totals.
