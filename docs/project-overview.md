# Project Overview — Local Food

## What it is

A local food vendor marketplace (inspired by Hotplate/Homegrown). Vendors get a storefront page; customers browse, add items to a single-vendor cart, and check out via Stripe. On payment confirmation, the vendor's order is marked paid and the customer gets an SMS pickup notification.

This is explicitly a **scaffold**: every layer (auth, payments, SMS, images, monitoring) is wired to a real (sandbox-mode) provider, but several vendor-management flows are stubbed UI with no backing form yet (see "Known gaps" below).

## Tech stack summary

| Category | Technology | Version | Role |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.13 | Pages + API routes, one deployable app |
| Language | TypeScript (strict) | ^5.6.2 | Type safety across app/lib/components |
| UI | React | ^18.3.1 | Server Components by default, client components at the cart/nav boundary |
| Styling | Tailwind CSS | ^3.4.11 | Utility classes inline, no CSS modules |
| Database | PostgreSQL (Neon) | — | Relational store |
| ORM | Prisma | ^5.20.0 | Schema, migrations, type-safe client |
| Auth | Clerk | ^5.7.0 | Hosted sign-in/up, session, route protection via middleware |
| Payments | Stripe (hosted Checkout) | ^16.12.0 | Payment session + webhook confirmation |
| SMS | Twilio | ^5.3.0 | Post-payment pickup notification |
| Images | Cloudinary | ^2.5.0 | Product/vendor image hosting (helper exists, not yet wired to any upload UI) |
| Monitoring | Sentry | ^8.30.0 | Runtime error capture (client/server/edge configs present) |
| Testing | Playwright | ^1.47.0 | E2E only — no unit test runner configured |
| CI | GitHub Actions | — | typecheck → lint → e2e, gated in that order |

## Architecture type

**Monolith**, single Next.js App Router codebase serving both UI and API routes. Repository type: single part (no client/server split, no monorepo tooling).

## Repository structure

```
local-food/
├── prisma/               # schema.prisma (source of truth) + seed.ts
├── src/
│   ├── app/               # pages + API routes (App Router)
│   ├── components/        # 4 shared components (2 client, 2 server)
│   └── lib/                # one file per external service + utils
├── tests/                 # 6 Playwright spec files, flat (not mirrored to src/)
├── .github/workflows/ci.yml
└── middleware.ts          # Clerk route protection
```

## Links to detailed docs

- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)

## Known gaps (scaffold status, not bugs)

- No create/edit forms for products or pickup slots — dashboard "Add product" / "Add slot" buttons are not wired to their existing `POST /api/products` and `POST /api/pickup-slots` routes.
- No vendor onboarding flow — a `Vendor` row must be created manually (or via seed) with a `clerkUserId` matching a real Clerk user.
- Cloudinary `uploadImage` helper exists but nothing in the UI calls it yet.
- Order status transitions (`PAID` → `READY` → `COMPLETED`) have no UI action; only the webhook moves `PENDING` → `PAID`.
- `PickupSlot.capacity` is tracked and displayed but never enforced — nothing blocks booking past capacity.
