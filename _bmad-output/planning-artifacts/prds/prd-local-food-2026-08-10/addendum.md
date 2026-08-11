# Addendum — local-food Admin & Inventory Expansion

Technical-how and rejected-alternative notes that don't belong in the PRD body. For architecture/downstream use. Sections ordered by FR-ID for random-access lookup against `prd.md`.

## Admin provisioning — options considered (FR-2)

- Clerk custom role/claim on the user's session — no new table, but ties admin-ness to Clerk's dashboard config (manual per-user setup there).
- New `Admin` table keyed by `clerkUserId` (mirrors how `Vendor` already works) — consistent with existing patterns, queryable/auditable in our own DB.
Leaning toward the second (consistency with `Vendor`'s existing `clerkUserId`-keyed shape), but this is an architecture call, not decided here.

## Vendor slug collision (FR-3)

Existing known gap (per project-context.md): "`Vendor.slug` has no uniqueness/collision handling beyond the DB constraint — duplicate slugs throw raw Prisma errors, not friendly ones." FR-3 closes this specifically for the new admin-add-vendor path; whether to also fix it for any existing vendor self-registration path is an architecture/scope call.

## Vendor soft-delete (FR-4)

Current schema cascades hard: `Vendor → Product` and `Vendor → Order` both carry `onDelete: Cascade` (`prisma/schema.prisma:46`, `:82`). That's now wrong for FR-4 — deleting a vendor must NOT remove Products (still referenced by existing `OrderItem`s) or Orders (must keep fulfilling). Needed schema changes:
- Add a deactivation marker to `Vendor` (e.g. `deletedAt: DateTime?`).
- Remove/replace the `onDelete: Cascade` on both relations — a real cascade would break fulfillment of in-flight orders and orphan `OrderItem` rows pointing at deleted `Product`s.
- Storefront route (`/vendors/{slug}`) and the checkout API both need a "vendor is deactivated" check — storefront renders the deleted-vendor message instead of listings; checkout rejects new orders for that vendor's products even if a stale client still has them in cart.
- Existing in-flight Orders (PENDING/CONFIRMED/etc.) are untouched by the flag — their fulfillment path (webhook, SMS, pickup) doesn't check vendor-deleted status at all.

## Stock decrement timing and concurrency (FR-8)

Checkout creates the Order as `PENDING` at Stripe-session-creation time, before payment is confirmed (`src/app/api/checkout/route.ts`). Confirmation arrives later via the Stripe webhook (`src/app/api/webhooks/*`). Decrementing Stock Quantity at session-creation time would undercount stock for every abandoned checkout (customer opens Stripe, closes the tab). Decrement must happen in the webhook handler, on the same transition that currently sets order status to paid — mirrors the existing `smsNotified`-flag pattern (set once, on confirmed payment, not eagerly).

Two customers racing for the last unit: a plain read-then-write (`findUnique` then `update`) has a TOCTOU gap. Needs either a conditional update (`UPDATE ... WHERE stockQuantity >= :qty`, checking rows-affected) or a DB transaction with a row lock. Prisma supports the conditional-update form without needing raw SQL — worth defaulting to that over a transaction for simplicity.

## Inventory dashboard page (FR-9)

New route under `src/app/dashboard/` (or an admin-scoped equivalent, pending how Admin routing is structured), following the existing Server Component pattern (`await prisma.*` directly in the page body, e.g. `src/app/dashboard/products/page.tsx`). Query spans all vendors (unlike existing dashboard pages, which scope to `getCurrentVendor()`), so it needs the Admin gate (FR-2), not the vendor-ownership gate other dashboard pages use.

## Low-stock alert de-dupe and delivery (FR-10)

"Once per crossing event" means the system needs to know the *previous* Stock Quantity to detect a crossing, not just the current value — e.g. store a boolean `lowStockAlerted` per product (reset to false when restocked above threshold), same shape as the existing `smsNotified` one-shot-flag pattern on Order.

Delivery should go through the existing `sendSms` function in `src/lib/sms/index.ts` (moved here from `src/lib/twilio.ts` under a provider-abstraction layer as of the mock-SMS-provider work merged the same day this PRD was drafted — `src/lib/sms/providers/{twilioProvider,mockProvider}.ts`), not a new client instantiation. Per CLAUDE.md's existing rule, a failed send must not be recorded as delivered.

## Cart quantity stepper (FR-11)

`CartProvider` (`src/components/CartProvider.tsx`) currently exposes only `addItem` (always +1 or new line) and `removeItem` (drops the whole line) — no `setQuantity`/increment-in-place method. Needs a new context method, e.g. `updateQuantity(productId, quantity)`, clamped to `[1, stockQuantity]` once FR-6–FR-8 land (before that ships, clamp floor only at 1, no ceiling). Cart state is in-memory React state only (no persistence), so this is a pure client-side change — no API route needed unless checkout-time re-validation (FR-7) already covers the ceiling check server-side, which it should regardless of what the client allowed.
