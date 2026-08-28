# Data Models

Source of truth: `prisma/schema.prisma`. Datasource: PostgreSQL (Neon) — `DATABASE_URL` (pooled, app queries) / `DIRECT_URL` (unpooled, migrations only). Always run `npm run prisma:migrate`, never `prisma db push` (project convention, not enforced by tooling).

## Entity relationship overview

```
Vendor 1───* Product 1───* OrderItem *───1 Order *───1 Vendor
  │                                                     │
  └──────────────────* PickupSlot *────────────────────┘
                         (Order.pickupSlotId is optional)
```

`Admin` isn't in this diagram — its two relations to `Vendor` (`createdVendors`, `deletedVendors` — Stories 2.2/2.3) are one-to-many attribution FKs, not part of the storefront/order chain above.

## Models

### Admin
A platform operator, distinct from a Vendor.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| clerkUserId | String | `@unique` — sole source of admin identity (architecture AD-1); `getCurrentAdmin()` looks up by this, never a Clerk session claim |
| phone | String? | low-stock/shortfall SMS destination (Story 3.2, AD-3) — nullable, mirrors `Vendor.phone`'s shape. `getAdminPhoneNumbers()` (`src/lib/admin.ts`) fans out to every `Admin` row with a phone set, not just one — a zero-configured-phones state is expected, not an error |
| createdAt / updatedAt | DateTime | |

Relations: `createdVendors[]` (`Vendor.createdByAdminId`, Story 2.2, named relation `VendorCreatedByAdmin`), `deletedVendors[]` (`Vendor.deletedByAdminId`, Story 2.3, named relation `VendorDeletedByAdmin`) — two separate named relations to `Vendor`, since Prisma requires distinct names once there's more than one relation between the same two models.

### Vendor
One seller, one storefront. `clerkUserId` may be `null` for an admin-created vendor not yet claimed by a signed-up Clerk user (AD-8, Story 2.2) — every vendor still has exactly one storefront regardless.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| clerkUserId | String? | `@unique` (nullable — Postgres/Prisma allow multiple `NULL`s under a unique index) — links storefront to a signed-in user once claimed; `getCurrentVendor()` looks up by this. `null` until an admin-created vendor is manually bound out-of-band (AD-8; no invite/claim flow exists) |
| name | String | |
| slug | String | `@unique` — used in URL `/vendors/{slug}`. The only path that creates a `Vendor` today, `POST /api/admin/vendors`, goes through `resolveVendorSlug()` (`src/lib/vendor.ts`, AD-7) — normalizes the slug, checks it, and returns a friendly `409` on collision. The route also catches the DB-level unique-constraint error as a fallback for a same-slug race between two concurrent requests, so a raw Prisma error should never reach the client either way |
| description | String? | |
| imageUrl | String? | Cloudinary URL — not yet populated by any UI flow |
| phone | String? | vendor contact, not currently displayed anywhere |
| createdByAdminId | String? | nullable FK → `Admin.id` (not `Admin.clerkUserId` — AD-5's attribution rule), named relation `VendorCreatedByAdmin`, `onDelete: SetNull`. Set only for admin-created vendors (`POST /api/admin/vendors`, Story 2.2) |
| deletedAt | DateTime? | soft-delete marker (Story 2.3, AD-4) — `null` means active. Never a hard delete; `assertVendorActive()` (`src/lib/vendor.ts`) is the sole check anywhere that cares, throws `VendorDeactivatedError` rather than returning a boolean. Slugs stay permanently reserved even after deactivation (human decision, Story 2.3 planning) — `resolveVendorSlug()` deliberately has no `deletedAt` filter |
| deletedByAdminId | String? | nullable FK → `Admin.id`, named relation `VendorDeletedByAdmin`, `onDelete: SetNull`. Set only when `deletedAt` is set (`POST /api/admin/vendors/[id]/deactivate`, Story 2.3) — a retry/double-click on an already-deactivated vendor does **not** overwrite this |
| timezone | String | IANA timezone identifier (e.g. `"America/New_York"`), `@default("America/New_York")` (Story 6.1, FR17) — pickup-slot `startsAt`/`endsAt` wall-clock input (`AddSlotForm.tsx`) is interpreted relative to this, not the submitting browser's timezone; also used to display pickup times on the storefront and vendor dashboard. Every pre-existing vendor was backfilled to the default by the migration itself. No vendor/admin-facing UI to change it exists yet |
| createdAt / updatedAt | DateTime | |

Relations: `products[]`, `orders[]`, `pickupSlots[]`, `createdByAdmin?` (`Admin.createdVendors`, Story 2.2), `deletedByAdmin?` (`Admin.deletedVendors`, Story 2.3).

### Product
Something a vendor sells.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| vendorId | String | FK → Vendor, `onDelete: Restrict` (Story 2.3 — was `Cascade`; a hard-delete of a Vendor with existing Products now fails at the DB level instead of silently destroying them. Vendors are only ever soft-deleted via `Vendor.deletedAt`, so this should never actually fire in normal operation), indexed |
| name | String | |
| description | String? | |
| priceCents | Int | money always stored as integer cents; ~$21.4M ceiling (32-bit Int), no overflow check |
| imageUrl | String? | Cloudinary URL |
| stockQuantity | Int | availability is derived, never stored (architecture AD-2) — `isInStock()` in `src/lib/availability.ts` is the single canonical check (`stockQuantity > 0`); checkout additionally requires `stockQuantity >= requestedQuantity` per line |
| lowStockThreshold | Int | vendor-set threshold for the dashboard's low-stock indicator |
| stockIsPlaceholder | Boolean | `true` for rows backfilled by Story 1.2's migration whose `stockQuantity` is still the migration sentinel, not a real vendor-entered value; cleared on the vendor's first genuine edit. Surfaced to the vendor as a "Needs review" badge on `/dashboard/products` (Story 1.6, FR13) |
| thresholdIsPlaceholder | Boolean | same as `stockIsPlaceholder`, for `lowStockThreshold` |
| stockVersion | Int, default 0 | monotonic counter bumped by every writer of `stockQuantity` (`setStock()`, `decrementStock()` in `src/lib/inventory.ts`). `setStock()`'s optimistic-lock guard checks this, not `stockQuantity` equality — closes an ABA gap a value-equality guard has (a decrement-then-restock can return `stockQuantity` to the exact value a vendor's stale page load saw). `setLowStockThreshold()` never bumps it — that field has no concurrent writer of its own |
| lowStockAlerted | Boolean, default false | one-shot flag, same shape as `Order.smsNotified` (Story 3.2, AD-3) — set `true` only after a low-stock SMS actually sends, never before a failed send. `decrementStock()` reports a newly-detected crossing (`crossedLowStock`) without setting this itself; the webhook sets it after a successful `sendSms()`. Reset to `false` by `setStock()` when a genuine restock brings `stockQuantity` back above `lowStockThreshold`, so a future crossing can alert again |
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
| vendorId | String | FK → Vendor, `onDelete: Restrict` (Story 2.3 — was `Cascade`, same reasoning as `Product.vendorId`: order history must survive even an accidental hard-delete), indexed |
| pickupSlotId | String? | FK → PickupSlot. Nullable at the DB level (no migration to backfill pre-Story-5.1 orders), but `POST /api/checkout` has required and set it on every order created since Story 5.1 — no longer always-null in practice, just for any order placed before that story shipped |
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
