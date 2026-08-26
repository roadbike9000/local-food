---
stepsCompleted: [1, 2, "3-epic1", "3-epic2", "3-epic3", 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
---

# local-food - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for local-food, decomposing the requirements from the PRD and Architecture requirements into implementable stories. No UX design contract exists for this feature set (no consumer/UX-heavy surface — confirmed during PRD Discovery).

## Requirements Inventory

### Functional Requirements

FR1: Customer can remove a cart line item and see an accurate total. **Already implemented** (`CartProvider.removeItem`) — ships as a verification/regression task, not new development.
FR2: The system restricts admin capabilities (vendor management, cross-vendor product management, inventory report/alerts) to users holding the Admin role, and attributes admin actions to the acting admin.
FR3: Admin adds a new Vendor to the platform, with friendly slug-collision handling.
FR4: Admin deactivates a Vendor (soft-delete) — storefront shows unavailable, no new orders placeable, but existing in-flight orders keep fulfilling and no data is deleted.
FR6: Out-of-stock (zero Stock Quantity) products are visibly marked everywhere they're displayed.
FR7: Out-of-stock products cannot be added to cart or carried through checkout; checkout re-validates stock sufficiency server-side.
FR8: Inventory updates immediately when a sale completes — stock decrements on payment confirmation (webhook), never goes negative, races resolve to one winner.
FR9: Admin can view current Stock Quantity across all vendors on demand (Inventory Report dashboard page).
FR10: Admin receives an SMS alert when a product's Stock Quantity crosses at or below its Low-Stock Threshold, once per crossing event.
FR11: Customer can adjust a cart line's quantity in place via a stepper (floor 1, ceiling = available stock).
FR12: Stock Quantity is captured at product creation and backfilled for every pre-existing Product (isAvailable:true → 100, isAvailable:false → 0).
FR13: Vendor is notified via a dashboard banner of any Product still at the placeholder Stock Quantity, prompting an update; banner clears on any edit.

*(FR5 is retired — "admin adds products" was confirmed to mean the existing vendor self-service `AddProductForm`, already implemented, no new work. Not listed as a build FR.)*

FR14: Vendor can upload a photo for a product; customers see it on the storefront (listing and detail).
FR15: Customer selects a pickup slot during checkout; the resulting Order is linked to that slot.
FR16: A vendor cannot create a pickup slot whose start time has already passed.

### NonFunctional Requirements

NFR1: Stock Quantity changes (decrement, threshold check) must be consistent under concurrent orders — no overselling the last unit (FR-8, FR-11).
NFR2: Server-side state is authoritative everywhere client state could be stale or manipulated — checkout re-validates stock sufficiency and vendor-active status regardless of client display (FR-7, FR-4).
NFR3: A failed SMS send is never recorded as delivered (mirrors existing `smsNotified` discipline) — applies to the low-stock alert (FR-10).
NFR4: No new external dependency is introduced — Admin auth reuses Clerk, stock alerts reuse the existing SMS module, no new library.

### Additional Requirements

- No starter template applies — brownfield app, existing Next.js 14 App Router codebase ratified as-is (Architecture Design Paradigm).
- Prisma schema changes: new `Admin` model (`clerkUserId` unique); `Vendor` gains `deletedAt`, `createdByAdminId`, `deletedByAdminId`, and `clerkUserId` becomes nullable; `Product` gains `stockQuantity`, `lowStockThreshold`, `lowStockAlerted` and drops `isAvailable`; `Vendor → Product` and `Vendor → Order` drop `onDelete: Cascade` (AD-1, AD-2, AD-4, AD-5, AD-8).
- Migration ordering constraint: `stockQuantity` must be backfilled for every existing Product *before* `isAvailable` is dropped (AD-2).
- New `src/lib` service functions: `getCurrentAdmin()` (AD-1/AD-6), `decrementStock()` + `setStock()` + `PLACEHOLDER_STOCK_QUANTITY` constant (AD-3/AD-9), `assertVendorActive()` (AD-4, throws `VendorDeactivatedError`), `resolveVendorSlug()` (AD-7).
- New route tree `src/app/admin/**` (`vendors/`, `inventory/`), separate from vendor's `src/app/dashboard/**`; every new admin route must be added to `middleware.ts`'s `isProtectedRoute` matcher (AD-6).
- Existing routes requiring modification: `src/app/api/checkout/route.ts` (stock sufficiency check, `assertVendorActive()`), `src/app/api/webhooks/*` (call `decrementStock()` on payment confirmation), `src/app/dashboard/products/page.tsx` (drop direct `isAvailable` read, add FR-13 banner, route stock edits through `setStock()`), storefront listing/detail pages (availability display).
- Multi-item order stock decrements run inside one DB transaction — all lines succeed or none do; a post-payment shortfall is flagged for manual admin review, not auto-resolved (AD-3, Deferred: auto-refund out of scope).
- `Product.imageUrl` already exists in the schema (Cloudinary URL) and is already accepted by `CreateProductSchema`, but has zero UI wiring anywhere (no upload, no display) — Epic 4 wires it end-to-end. No schema migration needed for the single-image scope decided for this epic (see Epic 4 below).
- `Order.pickupSlotId` already exists in the schema (nullable) but is never set — `POST /api/checkout` has no reference to `PickupSlot` at all today. Epic 5 wires checkout to capture and validate a slot selection; no schema migration needed for Story 5.1.
- Epic 4 and Epic 5 are both standalone — no dependency on Epics 1-3 or on each other.

### UX Design Requirements

None — no UX design contract exists for this feature set.

### FR Coverage Map

FR1: Epic 1 — cart line removal (verify, already implemented)
FR6: Epic 1 — out-of-stock UI marking
FR7: Epic 1 — out-of-stock blocks cart/checkout
FR8: Epic 1 — post-sale stock decrement
FR11: Epic 1 — cart quantity stepper
FR12: Epic 1 — Stock Quantity creation + backfill
FR13: Epic 1 — vendor placeholder-count notification
FR2: Epic 2 — Admin identity/gating
FR3: Epic 2 — admin adds vendor
FR4: Epic 2 — admin deactivates vendor
FR9: Epic 3 — admin inventory dashboard
FR10: Epic 3 — low-stock SMS alert
FR14: Epic 4 — vendor product image upload + storefront display
FR15: Epic 5 — checkout captures pickup-slot selection, Order links to it
FR16: Epic 5 — pickup slot creation rejects a past start time

## Epic List

### Epic 1: Accurate Stock & Cart
Customers only see and buy what's actually in stock, cart totals are always right, and vendors are told when their stock number is still a migration placeholder. Standalone — no admin dependency. FRs consolidated into one epic because they're tightly file-coupled around `Product.stockQuantity` / `src/lib/inventory.ts` / checkout / cart / storefront.
**FRs covered:** FR1, FR6, FR7, FR8, FR11, FR12, FR13

### Epic 2: Admin Vendor Lifecycle
Admin can onboard and deactivate vendors on the platform without touching the database directly. Includes the foundational Admin-identity/gating work as its first story.
**FRs covered:** FR2, FR3, FR4

### Epic 3: Admin Inventory Oversight
Admin can see stock levels across all vendors on demand and gets an SMS alert before something sells out. Builds on Epic 1 (needs `stockQuantity` to exist) and Epic 2 (needs Admin identity/gating) — both prior epics.
**FRs covered:** FR9, FR10

### Epic 4: Vendor Product Images
Vendors can upload a photo for each product so customers see what they're actually buying, not just a name and price. Standalone — no dependency on Epics 1-3.
**FRs covered:** FR14

### Epic 5: Pickup Slot & Order Integrity
Customer orders are linked to the pickup slot they were placed against, and a vendor can't create a slot that's already in the past. Standalone — no dependency on Epics 1-3, though Story 5.1 touches the same `/api/checkout` route Epic 1 built on.
**FRs covered:** FR15, FR16
**Scope note:** these two epics are the direct result of a scenario review with Jeff (2026-08-24) — see `scenarios from Jeff/Local Food Scnearios from Jeff.rtf`. Two of that review's four scenarios (vendor delete+re-add, ASCII punctuation in names) turned out to already be correctly handled by existing code and did **not** produce a new epic; see `deferred-work.md`'s new entry for the one small adjacent gap they did surface (accented/non-ASCII names). Jeff's date/timezone scenario surfaced a real, concrete prerequisite gap (orders were never linked to pickup slots at all — closed by Story 5.1) and a mechanical validation gap (Story 5.2), but the deeper question behind it — does this app need an explicit vendor-storefront timezone concept — is still open and deliberately **not** resolved here. See `deferred-work.md`'s open decision entry.

## Epic 1: Accurate Stock & Cart

Customers only see and buy what's actually in stock, cart totals are always right, and vendors are told when their stock number is still a migration placeholder. Standalone — no admin dependency.

### Story 1.1: Verify cart line removal and total accuracy

As a customer,
I want to remove an item from my cart and see the total update correctly,
So that I only pay for what I actually want.

**Acceptance Criteria:**

**Given** a cart with 2+ line items
**When** I remove one line
**Then** it disappears immediately and the total recalculates to the sum of remaining lines (no tax/shipping)
**And** removing the last item returns the cart to its empty state

*(Verification/regression task — `CartProvider.removeItem` already implements this; no new code expected, write the test. FR1.)*

### Story 1.2: Stock Quantity captured at creation, backfilled for existing products, and editable

As a vendor,
I want to set how many units of a product I have, and correct that number later,
So that the system knows my real stock, on an ongoing basis — not just once.

**Acceptance Criteria:**

**Given** the vendor's `AddProductForm`
**When** they create a new product
**Then** Stock Quantity and Low-Stock Threshold are both required fields — no product can be created without them, no default offered for either (vendor owns their own stock, per explicit product direction)
**And** on migration, every existing product's Stock Quantity is backfilled per `isAvailable` (`true` → 100, `false` → 0) and every existing product's Low-Stock Threshold is backfilled to 0 — both are named constants (`PLACEHOLDER_STOCK_QUANTITY`, `PLACEHOLDER_LOW_STOCK_THRESHOLD`, AD-9), never hardcoded at the call site
**And** the Low-Stock Threshold backfill of 0 is a neutral sentinel, not a real business number — a 0 threshold means the low-stock alert (FR-10) never fires until the vendor sets a real positive value themselves
**And** the vendor can edit an existing product's Stock Quantity and Low-Stock Threshold via a minimal inline control on `/dashboard/products` (not a full product-edit form — name/price/description editing is out of scope here) — this is the only way to correct either value after creation, and the only caller `setStock()` has
**And** the edit goes through `setStock()` — a conditional update guarded against the value the form last loaded, never a bare write — so a concurrent sale decrementing the same product can't be silently clobbered by the vendor's edit

*(FR12, AD-3, AD-9.)*

### Story 1.3: Out-of-stock products are marked and blocked

As a customer,
I want to see when something's sold out and be stopped from ordering it,
So that I never pay for something unavailable.

**Acceptance Criteria:**

**Given** a product with Stock Quantity 0
**When** it's shown on the storefront (listing or detail)
**Then** a visible out-of-stock badge renders and "add to cart" is disabled
**And** `isAvailable` is dropped from the schema — availability is computed as `stockQuantity > 0` at every read site, including `src/app/dashboard/products/page.tsx`
**And** checkout re-validates `stockQuantity >= requestedQuantity` per line server-side and rejects the whole order if any line is short, regardless of client state

*(FR6, FR7, AD-2.)*

### Story 1.4: Inventory decrements immediately on sale completion

As the platform,
I want stock to drop the moment a sale is confirmed,
So that inventory never says "in stock" when it isn't.

**Acceptance Criteria:**

**Given** a Stripe webhook confirms payment
**When** the order is marked paid
**Then** each line item's Stock Quantity decrements through `decrementStock()` (conditional update, never negative)
**And** a multi-item order's decrements happen inside one transaction — all succeed or none do
**And** two customers racing for the last unit resolve to exactly one success, one rejection
**And** stock never decrements at checkout-session creation — only on confirmed payment
**And** `decrementStock()` returns a shortfall result when a post-payment race leaves the order short (money captured, stock insufficient) — it never silently over-decrements or auto-refunds; actually notifying anyone about it is out of Epic 1's scope (no Admin exists yet at this point) and is completed by Story 3.2 once it does

*(FR8, AD-3, NFR1.)*

### Story 1.5: Cart quantity stepper

As a customer,
I want to bump a cart line's quantity up or down directly,
So that I don't have to remove and re-add it.

**Acceptance Criteria:**

**Given** a cart line
**When** I use the stepper
**Then** quantity moves between a floor of 1 and a ceiling of that product's Stock Quantity, and the total recalculates on every change
**And** the client-side ceiling is a UX hint only — checkout's server-side sufficiency check (Story 1.3) is still the sole enforcement point

*(FR11.)*

### Story 1.6: Vendor notified of placeholder Stock Quantity or Low-Stock Threshold

As a vendor,
I want to know which of my products still has a migration-placeholder Stock Quantity or Low-Stock Threshold,
So that I can enter the real numbers.

**Acceptance Criteria:**

**Given** a product whose Stock Quantity still equals `PLACEHOLDER_STOCK_QUANTITY`, or whose Low-Stock Threshold still equals `PLACEHOLDER_LOW_STOCK_THRESHOLD` (Story 1.2, AD-9)
**When** the vendor views `/dashboard/products`
**Then** a banner/badge flags that row — same banner mechanism for either placeholder, not two separate flags
**And** the banner disappears the moment the vendor edits the flagged field to any value — via Story 1.2's `setStock()` path, same as any other vendor edit, no separate write mechanism for clearing this flag
**And** no SMS/email is sent — dashboard-only

*(FR13, AD-9.)*

## Epic 2: Admin Vendor Lifecycle

Admin can onboard and deactivate vendors on the platform without touching the database directly.

### Story 2.1: Admin identity and access gating

As the platform,
I want a distinct Admin identity that gates admin-only routes and actions,
So that only trusted operators can manage vendors and inventory.

**Acceptance Criteria:**

**Given** a new `Admin` table keyed by `clerkUserId`
**When** a request hits any `/admin/*` route
**Then** `getCurrentAdmin()` resolves identity via the `Admin` table only — never a Clerk session claim — and the route is registered in `middleware.ts`'s `isProtectedRoute` matcher
**And** a signed-in user who is not in the `Admin` table is denied when hitting an `/admin/*` route or calling an admin action

*(FR2, AD-1, AD-6.)*

### Story 2.2: Admin adds a vendor

As an admin,
I want to onboard a new vendor onto the platform,
So that they can start selling without self-registering.

**Acceptance Criteria:**

**Given** the admin vendor-creation form (`/admin/vendors`)
**When** admin submits name, slug, and contact info
**Then** a new `Vendor` record is created with `clerkUserId: null` (unbound until claimed, AD-8) and `createdByAdminId` set to the acting admin
**And** a slug that collides with an existing vendor is rejected with a friendly error via `resolveVendorSlug()`, not a raw DB constraint failure
**And** the new vendor gets a live storefront at `/vendors/{slug}`

*(FR3, AD-5, AD-7, AD-8.)*

### Story 2.3: Admin deactivates a vendor

As an admin,
I want to deactivate a vendor,
So that they stop being orderable while their order history and fulfillment are preserved.

**Acceptance Criteria:**

**Given** an active vendor
**When** admin deactivates them
**Then** `Vendor.deletedAt` is set and `deletedByAdminId` records the acting admin, enforced through the shared `assertVendorActive()` guard (throws, never returns a boolean)
**And** a customer visiting that vendor's storefront sees a "no longer available" message instead of listings, and checkout rejects any new order for that vendor's products
**And** orders placed before deactivation, in any non-terminal status, continue their normal fulfillment lifecycle unchanged (pickup, SMS, status updates)
**And** the vendor's Products remain queryable (not deleted) for order history and fulfillment — `onDelete: Cascade` is removed from `Vendor → Product` and `Vendor → Order`

*(FR4, AD-4.)*

## Epic 3: Admin Inventory Oversight

Admin can see stock levels across all vendors on demand and gets an SMS alert before something sells out. Builds on Epic 1 (`stockQuantity` must exist) and Epic 2 (Admin identity/gating must exist).

### Story 3.1: Admin inventory dashboard

As an admin,
I want to see current stock levels across all vendors,
So that I can spot problems without asking each vendor.

**Acceptance Criteria:**

**Given** an admin is signed in
**When** they visit `/admin/inventory`
**Then** the page shows current Stock Quantity per product across all vendors, computed live at request time (Server Component fetch, no caching staleness)
**And** any product at or below its Low-Stock Threshold, or at 0, is visually flagged
**And** a non-admin visiting `/admin/inventory` is denied (reuses Story 2.1's `getCurrentAdmin()` gate)

*(FR9, AD-1, AD-6.)*

### Story 3.2: Low-stock SMS alert to admin

As an admin,
I want a text when a product's stock crosses its low-stock threshold,
So that I can act before it sells out.

**Acceptance Criteria:**

**Given** `Admin` gains a `phone` field (mirrors `Vendor.phone`) — required to actually deliver this story, missing from the original schema
**And** a product's Stock Quantity crosses at or below its Low-Stock Threshold as part of a Story 1.4 decrement
**When** `decrementStock()` reports the crossing as newly detected
**Then** the caller sends an SMS to the admin's phone via the existing `sendSms` module
**And** `lowStockAlerted` is set true only after the send succeeds — never before, mirroring the existing `smsNotified` pattern
**And** a failed send leaves `lowStockAlerted` false — it is never marked delivered
**And** further sales while stock stays below threshold do not trigger repeat alerts, until stock is restocked above threshold and crosses again
**And** a post-payment shortfall result from Story 1.4's `decrementStock()` (money captured, stock insufficient under a race) also triggers this same SMS mechanism to the admin's phone — closing the loop Epic 1 intentionally left open since Admin didn't exist yet at that point

*(FR10, FR8's shortfall consequence, AD-3, NFR3.)*

## Epic 4: Vendor Product Images

Vendors can upload a photo for each product so customers see what they're actually buying, not just a name and price. Standalone — no dependency on Epics 1-3.

### Story 4.1: Vendor uploads a product image

As a vendor,
I want to upload a photo for a product,
So that customers can see what they're buying before they order.

**Acceptance Criteria:**

**Given** the vendor's product creation form (`AddProductForm`) — no product-edit form exists in this codebase today (`PATCH /api/products/[id]` only ever handles Stock Quantity/Low-Stock Threshold, Story 1.2's deliberate scope); adding an image to an *existing* product is out of scope here
**When** they select an image file and submit
**Then** the file uploads to Cloudinary via a signed upload (server issues the signature; Cloudinary credentials never reach the browser) and the resulting URL is saved to `Product.imageUrl`
**And** the server rejects a submitted `imageUrl` that doesn't resolve to the app's own Cloudinary account host — `CreateProductSchema`'s current `z.string().url()` accepts any well-formed URL from any host, this narrows it (NFR2)
**And** an upload failure (network error, oversized file, wrong file type) shows an inline error and does not save a broken `imageUrl`
**And** a product with no image continues to work exactly as it does today — this field stays optional, every pre-existing product is unaffected

*(FR14, NFR2. Decision: single image per product, matching the current schema — multiple images per product would need a new `ProductImage[]` relation and is explicitly out of scope for this epic; revisit as its own epic if wanted later.)*

### Story 4.2: Product image displays on the storefront

As a customer,
I want to see a product's photo when I'm browsing,
So that I know what I'm actually buying.

**Acceptance Criteria:**

**Given** a product with `imageUrl` set
**When** it's shown on the storefront (listing or detail page)
**Then** the image renders alongside the existing name/price/description
**And** a product with no `imageUrl` (the common case for every pre-existing product) shows a neutral placeholder, never a broken-image icon
**And** image rendering never blocks the rest of the page — a slow-loading or failed image doesn't prevent the Add-to-cart button from being usable

*(FR14.)*

## Epic 5: Pickup Slot & Order Integrity

Customer orders are linked to the pickup slot they were placed against, and a vendor can't create a slot that's already in the past. Standalone — no dependency on Epics 1-3, though Story 5.1 touches the same `/api/checkout` route Epic 1 built on.

### Story 5.1: Customer selects a pickup slot at checkout; order links to it

As a customer,
I want to choose which pickup slot my order is for,
So that I know when and where to pick it up.

**Acceptance Criteria:**

**Given** a vendor with one or more upcoming pickup slots
**When** a customer reaches checkout
**Then** they're shown that vendor's available slots and must pick one before completing checkout — no order can be created without a `pickupSlotId`
**And** the selected slot's id is validated server-side (belongs to the correct vendor, still exists) before the order is created — never trusted from the client alone (NFR2)
**And** the resulting `Order.pickupSlotId` is set to the selected slot — this is currently always `null` for every real order today; closing that gap is this story's core deliverable
**And** a vendor with zero upcoming slots shows a clear "no pickup times available" state at checkout instead of a broken or empty picker

*(FR15, NFR2. Scope note: no pickup-slot selection UI exists anywhere in the current cart/checkout flow — this is new customer-facing UI, not just a backend wiring change.)*

### Story 5.2: Pickup slot creation rejects a start time already in the past

As the platform,
I want to reject a pickup slot whose start time has already elapsed,
So that customers are never offered a pickup window that's already over.

**Acceptance Criteria:**

**Given** the vendor's add-slot form (`AddSlotForm.tsx`) or a direct API call
**When** a slot is submitted with `startsAt` earlier than the current server time
**Then** `CreateSlotSchema` rejects it with a friendly 400 error, not a silently-created invalid slot
**And** the existing `endsAt > startsAt` check (already enforced) is unaffected by this change

*(FR16.)*

**Not yet a story:** the vendor-storefront-timezone question this epic's scenario review raised is now decided (2026-08-26, Jeff: add `Vendor.timezone`, compute all slot/cutoff times relative to it — see `deferred-work.md`) but not yet scoped or implemented. A future Story 5.3 should cover: the `Vendor.timezone` schema migration, threading it through `AddSlotForm.tsx`'s `datetime-local` handling, and any checkout/storefront "upcoming" logic that currently assumes a single implicit timezone. Doesn't block 5.1/5.2, which already shipped.
