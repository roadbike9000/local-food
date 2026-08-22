# Data Models

Source of truth: `prisma/schema.prisma`. Datasource: PostgreSQL (Neon) — `DATABASE_URL` (pooled, app queries) / `DIRECT_URL` (unpooled, migrations only). Always run `npm run prisma:migrate`, never `prisma db push` (project convention, not enforced by tooling).

## Entity relationship overview

```
Vendor 1───* Product 1───* OrderItem *───1 Order *───1 Vendor
  │                                                     │
  └──────────────────* PickupSlot *────────────────────┘
                         (Order.pickupSlotId is optional)
```

`Admin` isn't in this diagram — its one relation to `Vendor` (`createdVendors`, Story 2.2) is a one-to-many attribution FK, not part of the storefront/order chain above.

## Models

### Admin
A platform operator, distinct from a Vendor.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| clerkUserId | String | `@unique` — sole source of admin identity (architecture AD-1); `getCurrentAdmin()` looks up by this, never a Clerk session claim |
| createdAt / updatedAt | DateTime | |

Relations: `createdVendors[]` (`Vendor.createdByAdminId`, Story 2.2) — named relation `VendorCreatedByAdmin`, since Story 2.3 adds a second `Vendor → Admin` relation (`deletedByAdminId`) and Prisma requires distinct names once there are two.

No `phone` yet — Story 3.2 adds it (required to deliver that story's SMS alert, per its own AC).

### Vendor
One seller, one storefront. `clerkUserId` may be `null` for an admin-created vendor not yet claimed by a signed-up Clerk user (AD-8, Story 2.2) — every vendor still has exactly one storefront regardless.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| clerkUserId | String? | `@unique` (nullable — Postgres/Prisma allow multiple `NULL`s under a unique index) — links storefront to a signed-in user once claimed; `getCurrentVendor()` looks up by this. `null` until an admin-created vendor is manually bound out-of-band (AD-8; no invite/claim flow exists) |
| name | String | |
| slug | String | `@unique` — used in URL `/vendors/{slug}`. Self-registration has no collision-handling beyond the DB constraint; the admin-create path (`POST /api/admin/vendors`) goes through `resolveVendorSlug()` (`src/lib/vendor.ts`, AD-7) instead, which returns a friendly `409` rather than a raw Prisma error |
| description | String? | |
| imageUrl | String? | Cloudinary URL — not yet populated by any UI flow |
| phone | String? | vendor contact, not currently displayed anywhere |
| createdByAdminId | String? | nullable FK → `Admin.id` (not `Admin.clerkUserId` — AD-5's attribution rule), named relation `VendorCreatedByAdmin`, `onDelete: SetNull`. Set only for admin-created vendors (`POST /api/admin/vendors`, Story 2.2) |
| createdAt / updatedAt | DateTime | |

Relations: `products[]`, `orders[]`, `pickupSlots[]`.

### Product
Something a vendor sells.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| vendorId | String | FK → Vendor, `onDelete: Cascade`, indexed |
| name | String | |
| description | String? | |
| priceCents | Int | money always stored as integer cents; ~$21.4M ceiling (32-bit Int), no overflow check |
| imageUrl | String? | Cloudinary URL |
| stockQuantity | Int | availability is derived, never stored (architecture AD-2) — `isInStock()` in `src/lib/availability.ts` is the single canonical check (`stockQuantity > 0`); checkout additionally requires `stockQuantity >= requestedQuantity` per line |
| lowStockThreshold | Int | vendor-set threshold for the dashboard's low-stock indicator |
| stockIsPlaceholder | Boolean | `true` for rows backfilled by Story 1.2's migration whose `stockQuantity` is still the migration sentinel, not a real vendor-entered value; cleared on the vendor's first genuine edit. Surfaced to the vendor as a "Needs review" badge on `/dashboard/products` (Story 1.6, FR13) |
| thresholdIsPlaceholder | Boolean | same as `stockIsPlaceholder`, for `lowStockThreshold` |
| stockVersion | Int, default 0 | monotonic counter bumped by every writer of `stockQuantity` (`setStock()`, `decrementStock()` in `src/lib/inventory.ts`). `setStock()`'s optimistic-lock guard checks this, not `stockQuantity` equality — closes an ABA gap a value-equality guard has (a decrement-then-restock can return `stockQuantity` to the exact value a vendor's stale page load saw). `setLowStockThreshold()` never bumps it — that field has no concurrent writer of its own |
| createdAt / updatedAt | DateTime | |

Relations: `vendor`, `orderItems[]`.

### PickupSlot
A pickup window.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| vendorId | String | FK → Vendor, `onDelete: Cascade`, indexed |
| startsAt / endsAt | DateTime | no DB-level check that endsAt > startsAt (enforced only at the Zod layer in the API route) |
| capacity | Int | default `20` — displayed (`{{count}}/{{capacity}} booked`) but **not enforced**; nothing stops bookings past capacity |
| location | String? | |
| createdAt | DateTime | |

Relations: `vendor`, `orders[]`.

### Order
One customer purchase.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| vendorId | String | FK → Vendor, `onDelete: Cascade`, indexed |
| pickupSlotId | String? | FK → PickupSlot, optional |
| customerName | String | |
| customerPhone | String | used as the Twilio SMS destination |
| status | OrderStatus | default `PENDING`, indexed |
| totalCents | Int | computed server-side from DB product prices — never trust a client-sent total |
| stripeSessionId | String? | `@unique` — links back to the Stripe Checkout session; set right after session creation |
| smsNotified | Boolean | default `false` — the only replay guard on the SMS send; webhook is not otherwise idempotency-guarded |
| createdAt / updatedAt | DateTime | |

Relations: `vendor`, `pickupSlot?`, `items[]`.

### OrderItem
Line item, price snapshotted at order time.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| orderId | String | FK → Order, `onDelete: Cascade`, indexed |
| productId | String | FK → Product (no cascade — Product deletion would need to be checked) |
| quantity | Int | default `1`; API validates `.positive()` but has no ceiling |
| unitPriceCents | Int | price captured **at order time** — intentionally decoupled from `Product.priceCents` so historical orders don't change if a vendor edits a price later |

### OrderStatus (enum)
`PENDING → PAID → READY → COMPLETED`, or `CANCELLED` at any point.

- `PENDING`: created by `/api/checkout`, before Stripe confirms payment.
- `PAID`: set by `/api/webhooks/stripe` on `checkout.session.completed`. This is currently the **only** automated transition — nothing in the codebase sets `READY`, `COMPLETED`, or `CANCELLED`.

## Migration strategy

Prisma Migrate, imperative (`migrate dev` locally, presumably `migrate deploy` in a real deploy pipeline — no such step exists in `ci.yml` or any checked-in deploy config). `DIRECT_URL` bypasses Neon's connection pooler for migrations, which need a direct/session connection Prisma Migrate can hold a lock on.
