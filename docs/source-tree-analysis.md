# Source Tree Analysis

```
local-food/
├── middleware.ts                    # Clerk auth gate — protects /dashboard(.*) and /admin(.*), leaves everything else + all API routes public at the middleware layer (routes still self-check auth)
├── next.config.mjs
├── tailwind.config.ts                # defines the `brand` / `brand-dark` custom colors used throughout
├── playwright.config.ts              # webServer auto-starts `npm run dev`
│
├── prisma/
│   ├── schema.prisma                 # SOURCE OF TRUTH for DB shape — 5 models, 1 enum (see data-models.md)
│   └── seed.ts                       # idempotent: deletes all rows then recreates 2 vendors w/ products + 1 pickup slot each
│
├── src/
│   ├── app/                          # Next.js App Router — folder structure = route structure
│   │   ├── layout.tsx                 # ENTRY POINT — wraps every page in ClerkProvider → CartProvider → Navbar
│   │   ├── page.tsx                   # GET / — vendor directory (Server Component, direct prisma call)
│   │   ├── globals.css
│   │   │
│   │   ├── vendors/[slug]/page.tsx    # GET /vendors/:slug — storefront; notFound() if slug unmatched
│   │   ├── cart/page.tsx              # GET /cart — "use client", reads CartProvider, POSTs /api/checkout
│   │   ├── checkout/success/page.tsx  # GET /checkout/success — static thank-you, no server logic
│   │   │
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk catch-all route (hosted UI)
│   │   ├── sign-up/[[...sign-up]]/page.tsx   # Clerk catch-all route (hosted UI)
│   │   │
│   │   ├── dashboard/                 # vendor-only area — protected by middleware matcher
│   │   │   ├── layout.tsx              # tab nav (Overview/Products/Orders/Pickup slots)
│   │   │   ├── page.tsx                # GET /dashboard — stats via getCurrentVendor()
│   │   │   ├── products/page.tsx       # GET /dashboard/products — read-only table; "Add product" button unwired
│   │   │   ├── orders/page.tsx         # GET /dashboard/orders — read-only table, take: 50
│   │   │   └── pickups/page.tsx        # GET /dashboard/pickups — read-only list; "Add slot" button unwired
│   │   │
│   │   └── api/                       # route handlers — INTEGRATION POINT for external services
│   │       ├── checkout/route.ts         # POST — creates Order(PENDING) + Stripe session; recomputes prices server-side
│   │       ├── products/route.ts         # GET/POST — vendor-scoped via getCurrentVendor()
│   │       ├── pickup-slots/route.ts     # GET/POST — vendor-scoped via getCurrentVendor()
│   │       └── webhooks/stripe/route.ts  # POST — Stripe signature verify (raw body) → Order PAID → Twilio SMS
│   │
│   ├── components/                    # flat, no subfolders — 4 files
│   │   ├── CartProvider.tsx            # "use client" — React Context, single-vendor cart, in-memory only (lost on refresh)
│   │   ├── Navbar.tsx                  # "use client" — reads cart count + Clerk SignedIn/SignedOut
│   │   ├── ProductCard.tsx             # "use client" — has the "Add" button calling useCart().addItem
│   │   └── VendorCard.tsx              # Server Component — pure display, no interactivity
│   │
│   └── lib/                           # one file per external service — CRITICAL BOUNDARY (secrets live here, never in "use client" files)
│       ├── prisma.ts                   # singleton client, cached on globalThis to survive Next.js dev reloads
│       ├── stripe.ts                   # Stripe client + a formatPrice() duplicate (see Notes below)
│       ├── twilio.ts                   # sendSms() no-ops+logs if creds absent; swallows send failures (never throws)
│       ├── cloudinary.ts               # uploadImage() helper — not yet called from any route/component
│       ├── vendor.ts                   # getCurrentVendor() — the auth→Vendor lookup used by every dashboard route
│       └── utils.ts                    # slugify, formatPrice, formatPickupWindow — the canonical formatPrice per project-context.md
│
├── tests/                             # flat, NOT mirrored to src/ — one file per feature area
│   ├── homepage.spec.ts
│   ├── auth.spec.ts
│   ├── storefront-cart.spec.ts        # requires `npm run db:seed` (hits corner-sourdough)
│   ├── payment.spec.ts                # requires seed + Stripe test keys; self-skips if unconfigured
│   ├── sms.spec.ts                    # tests phone-number gating, not actual SMS delivery
│   └── dashboard.spec.ts
│
└── .github/workflows/ci.yml           # prisma generate → typecheck → lint → e2e, in that order
```

## Entry points

- **App bootstrap**: `src/app/layout.tsx` — every page passes through `ClerkProvider` → `CartProvider` → `Navbar`.
- **Auth gate**: `middleware.ts` — runs before any route; `/dashboard(.*)` and `/admin(.*)` are hard-protected, but API routes are matched too (they self-check via `getCurrentVendor()`/`getCurrentAdmin()`).
- **Payment entry**: `src/app/api/checkout/route.ts` — the only place an `Order` is created.
- **Payment confirmation entry**: `src/app/api/webhooks/stripe/route.ts` — the only place an `Order` moves to `PAID`.

## Notes / discrepancies found during scan

- **Duplicate `formatPrice`**: defined independently in both `src/lib/utils.ts` and `src/lib/stripe.ts`, with identical bodies. `project-context.md` documents `utils.ts`'s version as "the only place" — the `stripe.ts` copy appears to be a leftover and is unused by any page/component checked (all consumers import from `@/lib/utils`).
