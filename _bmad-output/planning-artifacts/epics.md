---
stepsCompleted: [1, 2, "3-epic1"]
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

### NonFunctional Requirements

NFR1: Stock Quantity changes (decrement, threshold check) must be consistent under concurrent orders — no overselling the last unit (FR-8, FR-11).
NFR2: Server-side state is authoritative everywhere client state could be stale or manipulated — checkout re-validates stock sufficiency and vendor-active status regardless of client display (FR-7, FR-4).
NFR3: A failed SMS send is never recorded as delivered (mirrors existing `smsNotified` discipline) — applies to the low-stock alert (FR-10).
NFR4: No new external dependency is introduced — Admin auth reuses Clerk, stock alerts reuse the existing SMS module, no new library.

### Additional Requirements

- No starter template applies — brownfield app, existing Next.js 14 App Router codebase ratified as-is (Architecture Design Paradigm).
- Prisma schema changes: new `Admin` model (`clerkUserId` unique); `Vendor` gains `deletedAt`, `createdByAdminId`, `deletedByAdminId`, and `clerkUserId` becomes nullable; `Product` gains `stockQuantity`, `lowStockThreshold`, `lowStockAlerted` and drops `isAvailable`; `Vendor → Product` and `Vendor → Order` drop `onDelete: Cascade` (AD-1, AD-2, AD-4, AD-5, AD-8).
- Migration ordering constraint: `stockQuantity` must be backfilled for every existing Product *before* `isAvailable` is dropped (AD-2).
- New `src/lib` service functions: `getCurrentAdmin()` (AD-1/AD-6), `adjustStock()` + `PLACEHOLDER_STOCK_QUANTITY` constant (AD-3/AD-9), `assertVendorActive()` (AD-4, throws `VendorDeactivatedError`), `resolveVendorSlug()` (AD-7).
- New route tree `src/app/admin/**` (`vendors/`, `inventory/`), separate from vendor's `src/app/dashboard/**`; every new admin route must be added to `middleware.ts`'s `isProtectedRoute` matcher (AD-6).
- Existing routes requiring modification: `src/app/api/checkout/route.ts` (stock sufficiency check, `assertVendorActive()`), `src/app/api/webhooks/*` (call `adjustStock()` on payment confirmation), `src/app/dashboard/products/page.tsx` (drop direct `isAvailable` read, add FR-13 banner), storefront listing/detail pages (availability display).
- Multi-item order stock decrements run inside one DB transaction — all lines succeed or none do; a post-payment shortfall is flagged for manual admin review, not auto-resolved (AD-3, Deferred: auto-refund out of scope).

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

## Epic List

### Epic 1: Accurate Stock & Cart
Customers only see and buy what's actually in stock, cart totals are always right, and vendors are told when their stock number is still a migration placeholder. Standalone — no admin dependency. FRs consolidated into one epic because they're tightly file-coupled around `Product.stockQuantity` / `adjustStock()` / checkout / cart / storefront.
**FRs covered:** FR1, FR6, FR7, FR8, FR11, FR12, FR13

### Epic 2: Admin Vendor Lifecycle
Admin can onboard and deactivate vendors on the platform without touching the database directly. Includes the foundational Admin-identity/gating work as its first story.
**FRs covered:** FR2, FR3, FR4

### Epic 3: Admin Inventory Oversight
Admin can see stock levels across all vendors on demand and gets an SMS alert before something sells out. Builds on Epic 1 (needs `stockQuantity` to exist) and Epic 2 (needs Admin identity/gating) — both prior epics.
**FRs covered:** FR9, FR10

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

### Story 1.2: Stock Quantity captured at creation, backfilled for existing products

As a vendor,
I want to set how many units of a product I have,
So that the system knows my real stock.

**Acceptance Criteria:**

**Given** the vendor's `AddProductForm`
**When** they create a new product
**Then** Stock Quantity is a required field — no product can be created without one
**And** on migration, every existing product with `isAvailable: true` is backfilled to 100, every `isAvailable: false` product to 0 (`PLACEHOLDER_STOCK_QUANTITY` constant, AD-9)
**And** Low-Stock Threshold is likewise captured per-product at creation

*(FR12.)*

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
**Then** each line item's Stock Quantity decrements through `adjustStock()` (conditional update, never negative)
**And** a multi-item order's decrements happen inside one transaction — all succeed or none do
**And** two customers racing for the last unit resolve to exactly one success, one rejection
**And** stock never decrements at checkout-session creation — only on confirmed payment

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

### Story 1.6: Vendor notified of placeholder Stock Quantity

As a vendor,
I want to know which of my products still has a migration-placeholder count,
So that I can enter the real number.

**Acceptance Criteria:**

**Given** a product whose Stock Quantity still equals `PLACEHOLDER_STOCK_QUANTITY`
**When** the vendor views `/dashboard/products`
**Then** a banner/badge flags that row
**And** the banner disappears the moment the vendor edits that product's Stock Quantity to any value
**And** no SMS/email is sent — dashboard-only

*(FR13, AD-9.)*
