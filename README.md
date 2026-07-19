# Local Food

A local food vendor marketplace, inspired by Hotplate and Homegrown. Vendors
get a storefront, customers order for pickup, and the platform handles payments,
SMS notifications, and image hosting.

This repository is a **full scaffold**: every folder, config file, and key
source file is in place, with sandbox-friendly defaults so you can run the whole
thing at zero cost while developing. It is a starting point to grow, not a
finished product.

## The stack (and why each piece is here)

| Concern | Tool | Why |
|---|---|---|
| Framework / API | **Next.js 14** (App Router, TypeScript) | One codebase for UI *and* backend API routes. Deploys to Vercel with no server to manage. |
| Database | **PostgreSQL** on **Neon** | Reliable relational DB; Neon has a generous free tier and branches for testing. |
| ORM | **Prisma** | Type-safe database access. You describe tables in one schema file and get autocompletion everywhere. |
| Auth | **Clerk** | Drop-in sign-in/sign-up and session handling so you do not write auth from scratch. |
| Payments | **Stripe** (hosted checkout) | Stripe hosts the payment page, so you never touch raw card data. A webhook confirms the order. |
| SMS | **Twilio** | Texts the customer when their order is confirmed. |
| Images | **Cloudinary** | Stores and resizes product photos on a CDN. |
| Monitoring | **Sentry** | Captures runtime errors in production. |
| Testing | **Playwright** | End-to-end tests that drive a real browser. |
| CI | **GitHub Actions** | Runs typecheck, lint, and tests on every push. |

## How the pieces fit together

```
Customer → Storefront page → Cart → /api/checkout ──▶ Stripe Checkout
                                                          │ (customer pays)
                                                          ▼
                                        Stripe ──▶ /api/webhooks/stripe
                                                          │
                                              marks Order paid in Postgres
                                                          │
                                                   Twilio sends SMS
```

Everything the customer sees is a Next.js page under `src/app`. Anything that
talks to another service (Stripe, Twilio, the database) lives behind an API
route under `src/app/api` or a helper in `src/lib`. Keeping that boundary clean
means the browser never sees a secret key.

## Project layout

```
local-food/
├── prisma/
│   ├── schema.prisma        # database tables (the source of truth)
│   └── seed.ts              # sample vendors/products for local dev
├── src/
│   ├── app/                 # pages + API routes (Next.js App Router)
│   │   ├── page.tsx         # homepage: list of vendors
│   │   ├── vendors/[slug]/  # a vendor's storefront
│   │   ├── cart/            # cart + "checkout" button
│   │   ├── dashboard/       # vendor: products, orders, pickup slots
│   │   └── api/             # checkout, stripe webhook, products, pickup-slots
│   ├── components/          # reusable UI (cards, navbar, cart state)
│   └── lib/                 # one file per external service
├── tests/                   # Playwright end-to-end specs
├── .github/workflows/ci.yml # continuous integration
└── .env.example             # copy to .env and fill in
```

## Getting it running locally

You will need **Node.js 18.17+** and **npm**.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in at least `DATABASE_URL` / `DIRECT_URL` (Neon) and the Clerk keys to
   get the app to boot. The other services can stay blank until you need them.

3. **Create the database tables**
   ```bash
   npm run prisma:migrate      # creates tables from schema.prisma
   npm run db:seed             # inserts sample vendors + products
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

### Testing Stripe payments locally

Stripe needs to reach your machine to deliver the "payment succeeded" webhook.
Use the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`. Then use test card
`4242 4242 4242 4242`, any future expiry, any CVC.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Production build |
| `npm run typecheck` | Check TypeScript types without emitting files |
| `npm run lint` | Run ESLint |
| `npm run prisma:studio` | Open a visual DB browser |
| `npm run db:seed` | Load sample data |
| `npm run test:e2e` | Run Playwright end-to-end tests |

## Next steps

This scaffold gives you working shapes for each feature. Natural things to build
out next: real product images through Cloudinary uploads, order status updates,
vendor onboarding, and locking pickup slots to capacity. Each service already
has a helper in `src/lib`, so you extend rather than start over.
