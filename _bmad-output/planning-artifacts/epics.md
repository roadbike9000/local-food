---
stepsCompleted: [1, 2, "3-epic1", "3-epic2", "3-epic3", 4, "3-epic8-done"]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md
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
FR17: A pickup slot's `startsAt`/`endsAt` are interpreted relative to that vendor's own configured timezone, not the timezone of whoever's browser is creating the slot.
FR18: A vendor's real IANA timezone can be set by an admin (not permanently pinned to the schema default).
FR19: The customer-facing storefront presents a cohesive, polished visual design credible for a production/client demo, replacing the current plain styling — realized via UX-DR1–13 (see UX Design Requirements).

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
- `Vendor` has no timezone field today — `AddSlotForm.tsx` interprets its `datetime-local` input using whoever's browser submits the form, with nothing stored about which timezone that was. Epic 6 adds `Vendor.timezone` (new, backfilled column) and threads it through slot creation. No date library (`date-fns`/`luxon`/`dayjs`) exists in this codebase today — Epic 6 either adds one or does the UTC-offset conversion manually; a decision for that story, not decided here.
- Epic 8 is a visual-only reskin of the 4 customer-facing storefront surfaces (`src/app/page.tsx`, `src/app/vendors/[slug]/page.tsx`, `src/app/cart/page.tsx`, `src/app/checkout/success/page.tsx`) plus their component tree (`VendorCard.tsx`, `ProductCard.tsx`, `Navbar.tsx`). No new npm dependency — `DESIGN.md` explicitly chose system Georgia over a webfont/Google Fonts load to avoid one. Tailwind utility classes remain the styling mechanism (no CSS modules/styled-components, per this codebase's existing convention) — new tokens map onto Tailwind's `theme.extend`/arbitrary-value utilities, not a new styling system. No schema/API changes — cart logic, checkout flow, and pickup-slot availability behavior are explicitly unchanged (per `EXPERIENCE.md` Foundation). Vendor dashboard and admin panel are out of scope. Standalone — no dependency on Epics 1-7.

### UX Design Requirements

Sourced from the finalized `bmad-ux` spine pair (`_bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md` + `EXPERIENCE.md`, status: final) — the "Artisanal Warm" direction (Terracotta & Olive palette), approved by Jeff after reviewing 4 rendered directions, 2 repaint variants, and a real-photography pass. Covers the 4 customer-facing storefront surfaces only (homepage, vendor page, cart/checkout, checkout-success) — vendor dashboard and admin panel are out of scope.

UX-DR1: Implement the Artisanal Warm design token system (Terracotta & Olive color palette, Georgia/system-sans typography scale, rounded/spacing/shadow scales — `DESIGN.md` frontmatter) — replaces the app's current single-color Tailwind config (`brand` only, no typography/spacing scale).
UX-DR2: Header cart-pill redesign (`{components.header-cart-pill}`) — icon + live count badge, plus **new** `aria-label="Cart, {count} items"` on the link and `aria-hidden="true"` on its icon; `src/components/Navbar.tsx`'s cart link has no accessible name today.
UX-DR3: `VendorCard.tsx` (homepage directory) — whole-card-link pattern (`wholeCardLink: true`), category accent panel + accent-icon, "View menu" visual label (not a second interactive element).
UX-DR4: Vendor page (`src/app/vendors/[slug]/page.tsx`) — hero photo with `{components.caption-plate}`, `{components.pickup-banner}`, `{components.squiggle-divider}`, product rows with `{components.circular-thumb}`.
UX-DR5: Cart/checkout page (`src/app/cart/page.tsx`) — 2-column layout (`1.55fr 1fr`: items+total left, contact/pickup-time/checkout right), restyled quantity stepper (`{colors.field-border}`), pickup-option rows (selected/full visual states), input fields (`{colors.field-border}`, `{colors.placeholder-text}`).
UX-DR6: Checkout-success page (`src/app/checkout/success/page.tsx`) — `{components.confirm-card}`, `{components.check-badge}`, low-opacity squiggle flourish (never confetti).
UX-DR7: Replace all icon usage — including `ProductCard.tsx`'s no-image fallback — with the hand-drawn inline-SVG icon set (`{components.icon-line}`: basket, clock, wheat, leaf, checkmark). Explicit no-emoji requirement (Jeff rejected emoji glyphs during discovery).
UX-DR8: Consolidate shadow/radius/spacing values onto the `DESIGN.md` scale; resolve 2 documented mock-drift spots (a near-duplicate `sold-out-bg` hex, and a couple pixels of spacing drift) by standardizing on the canonical token, not the drifted mock value.
UX-DR9: System-wide visible focus ring (`{components.focus-ring}`, terracotta outline, 6.07:1/5.28:1 contrast) on every interactive element across all 4 surfaces — currently unspecified/inconsistent in the live app.
UX-DR10: Add `role="alert"` + `aria-live="polite"` to `cart/page.tsx`'s 3 dynamic error/warning messages (checkout error, pickup-times-fetch-failure, "no longer available — remove to continue") — currently plain `<p>` text with no screen-reader announcement, despite gating checkout completion.
UX-DR11: **Regression guard, not new work** — preserve existing accessibility patterns during the reskin: `ProductCard.tsx`'s `aria-disabled`/`aria-describedby` sold-out pattern, the cart stepper's native `disabled` + `aria-live="polite"` quantity announcement, and the pickup-option's real `<fieldset>`/`<legend>`/radio-input group (2+ options) — the visual mocks must not tempt an implementer into replacing any of these with non-interactive styled divs.
UX-DR12: Desktop-primary responsive web only (per `EXPERIENCE.md` Foundation) — no native mobile-specific interaction patterns. Standard `Tab`/`Enter`/`Space` keyboard reachability throughout; no carousels, auto-play, or hover-only affordances (per Interaction Primitives).

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
FR17: Epic 6 — pickup-slot times interpreted relative to the vendor's own timezone
FR18: Epic 7 — vendor's real timezone can be set (not permanently pinned to the schema default)
FR19: Epic 8 — storefront visual redesign (Artisanal Warm direction)

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

### Epic 6: Vendor Pickup-Slot Timezone
A vendor's pickup-slot times are interpreted relative to that vendor's own configured timezone, not the timezone of whoever's browser happened to submit the slot form. Resolves the open timezone question Epic 5 deliberately left unanswered (`deferred-work.md`, decided by Jeff 2026-08-26, scoped into a story here on 2026-08-27). Deliberately a new epic rather than a reopening of Epic 5 — Epic 5 closed with its original 2-story scope and a completed retrospective; this is genuinely new, standalone follow-up work, not a gap in Epic 5's own stories.
**FRs covered:** FR17

### Epic 7: Vendor Timezone Configuration
A vendor's real timezone can actually be set, so `Vendor.timezone` reflects reality instead of every vendor being permanently pinned to the schema default (`America/New_York`) with no way to change it. Direct follow-up to Epic 6's code review (`deferred-work.md`, decided by Jeff 2026-08-28): keep `America/New_York` as the default, but the system must genuinely support vendors located elsewhere. Deliberately a new epic rather than a reopening of Epic 6 — Epic 6 closed with its original 1-story scope and a completed retrospective; Epic 6 already built the read-side timezone-aware machinery (`AddSlotForm`, `formatPickupWindow`, checkout/storefront display), so this epic is specifically the write-side gap it left open.
**FRs covered:** FR18

### Epic 8: Storefront Visual Redesign
Customers browsing and ordering from the storefront see a polished, cohesive "Artisanal Warm" visual design — credible for a production demo — instead of the current plain, inconsistent styling. Sourced from the finalized `bmad-ux` spine pair (`_bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md` + `EXPERIENCE.md`), approved by Jeff after reviewing 4 rendered directions, 2 repaint variants, and a real-photography pass. Visual-only — no schema/API changes, cart/checkout/pickup-slot behavior unchanged. Standalone — no dependency on Epics 1-7; vendor dashboard and admin panel untouched.
**FRs covered:** FR19

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

**Not yet a story (as of Epic 5's own completion):** the vendor-storefront-timezone question this epic's scenario review raised was decided (2026-08-26, Jeff: add `Vendor.timezone`, compute all slot/cutoff times relative to it — see `deferred-work.md`) but not yet scoped or implemented as of Epic 5's retrospective. It's now scoped as Story 6.1, below — a new epic rather than a reopening of this one (Epic 5 closed with its original 2-story scope intact).

## Epic 6: Vendor Pickup-Slot Timezone

A vendor's pickup-slot times are interpreted relative to that vendor's own configured timezone, not the timezone of whoever's browser happened to submit the slot form. Standalone — no dependency on Epics 1-4; builds on Epic 5's `PickupSlot`/checkout wiring but doesn't require any further changes to it (the `startsAt`/`endsAt` comparisons Epic 5 added already compare absolute instants and are timezone-agnostic by construction — see Story 5.2's own Dev Notes).

### Story 6.1: Pickup-slot times are interpreted in the vendor's own timezone

As a vendor,
I want the pickup times I enter to be understood as *my* local time, not the browser's,
So that a slot I create is never silently off by however many hours separate my timezone from whoever's device submitted the form.

**Acceptance Criteria:**

**Given** the `Vendor` model has no timezone concept today
**When** this story ships
**Then** `Vendor` gains a `timezone` column (IANA timezone identifier, e.g. `"America/New_York"`) with a sane default, backfilled for every existing vendor — no admin/vendor-facing UI to *change* it is required by this story, just the field existing and being used

**Given** a vendor submitting `AddSlotForm.tsx`'s `datetime-local` inputs
**When** they enter a `startsAt`/`endsAt`
**Then** the value is interpreted as being in that vendor's configured `timezone`, not the submitting browser's local timezone, before being converted to the absolute UTC instant stored in `PickupSlot.startsAt`/`endsAt` — closes the exact gap named in the original scenario review: someone in a different timezone than the vendor's actual business location can no longer silently create a slot that's off by the offset between the two

**Given** the existing past-`startsAt` rejection (`CreateSlotSchema`, Story 5.2) and the existing "upcoming slots" queries (Story 5.1's public pickup-slots route, `POST /api/checkout`'s slot lookup)
**When** this story ships
**Then** both continue to work correctly without modification — they already compare absolute UTC instants (`new Date()` on the server vs. the stored instant), which is timezone-agnostic by construction; confirm this holds rather than assuming, and note explicitly in Completion Notes if a gap is found

**Given** the storefront's "Next pickup" banner (`formatPickupWindow`, `vendors/[slug]/page.tsx`) and the vendor dashboard's own slot listing
**When** a pickup time is displayed
**Then** define and document which timezone it's displayed in (the vendor's configured timezone is the natural choice for both surfaces, since pickup happens at the vendor's physical location regardless of which timezone the viewer is browsing from) — this is a real design decision this story needs to make explicitly, not inherit by accident from `formatPickupWindow`'s current browser-local behavior

*(FR17. Decision needed during story creation: this codebase has no date library today (`grep` confirms no `date-fns`/`luxon`/`dayjs`/`date-fns-tz` in `package.json`) — whether to add one (`date-fns-tz` is a natural minimal fit) or hand-roll the offset conversion with raw `Intl.DateTimeFormat` is an explicit choice this story needs to make, not a default to inherit.)*

## Epic 7: Vendor Timezone Configuration

A vendor's real timezone can actually be set by an admin, so `Vendor.timezone` reflects reality instead of every vendor being permanently pinned to the schema default. Standalone — no dependency on Epics 1-5; builds on Epic 6's read-side timezone machinery (`AddSlotForm.tsx`, `formatPickupWindow`, checkout/storefront display) but doesn't require any changes to it — that machinery already correctly reads whatever `Vendor.timezone` holds, this epic just gives it a real way to be set to something other than the default.

### Story 7.1: Admin sets a vendor's real timezone

As an admin,
I want to set a vendor's real IANA timezone at creation and edit it later for an existing vendor,
So that `Vendor.timezone` reflects where the vendor actually operates instead of silently defaulting to `America/New_York` with no way to correct it.

**Acceptance Criteria:**

**Given** the admin "add vendor" form (`CreateVendorSchema`-backed, `src/app/api/admin/vendors/route.ts`) has no timezone field today
**When** this story ships
**Then** the create form and schema gain a `timezone` field (IANA identifier, e.g. `"America/Los_Angeles"`), defaulting to `"America/New_York"` but changeable by admin at creation time — validated server-side with `isValidTimeZone()` (`src/lib/timezone.ts`, built in Story 6.1), not a new duplicate check

**Given** no route exists today to edit any field of an already-created vendor — only `POST /api/admin/vendors/[id]/deactivate` exists, nothing lets admin correct a vendor's data after onboarding
**When** this story ships
**Then** a new route (e.g. `PATCH /api/admin/vendors/[id]`) lets admin update an existing vendor's `timezone`, validated the same way as creation, so a vendor onboarded with the wrong default isn't permanently stuck with it

**Given** the admin vendors list page (`src/app/admin/vendors/page.tsx`) has no per-vendor edit affordance today
**When** this story ships
**Then** admin can view and change a vendor's timezone from this page (inline edit or a per-vendor edit view — implementer's choice) without needing direct database access

**Given** Story 6.1's existing read-side machinery (`AddSlotForm.tsx`'s conversion calls, `formatPickupWindow()`, the pickup-slots API's `timezone` field) already reads `Vendor.timezone` fresh on every request
**When** an admin changes an existing vendor's timezone value
**Then** `AddSlotForm`, checkout, and storefront pickup-slot display all reflect the new value on their next read — no separate propagation, cache invalidation, or backfill step needed; confirm this holds rather than assume, and note explicitly in Completion Notes if a gap is found

**Given** a malformed or unrecognized timezone string
**When** admin submits it, at creation or edit
**Then** the request is rejected server-side with a validation error before any write, reusing `isValidTimeZone()` rather than duplicating that check inline in the schema

*(FR18. Scope decision made during story creation (Jeff, 2026-08-28): admin-set field only — no new vendor-facing self-service settings surface. Matches this app's existing pattern (admin already owns vendor onboarding per Epic 2); vendors have no self-service settings page anywhere in this app today, and building the first one was explicitly out of scope for this epic.)*

## Epic 8: Storefront Visual Redesign

Customers browsing and ordering from the storefront see a polished, cohesive "Artisanal Warm" visual design — credible for a production demo — instead of the current plain, inconsistent styling. Sourced from the finalized `bmad-ux` spine pair (`_bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md` + `EXPERIENCE.md`, status: final), approved by Jeff after reviewing 4 rendered directions, 2 repaint variants, and a real-photography pass. Visual-only — no schema/API changes, cart/checkout/pickup-slot behavior unchanged (per `EXPERIENCE.md#Foundation`). Vendor dashboard and admin panel are out of scope. Standalone — no dependency on Epics 1-7.

### Story 8.1: Design-token foundation and shared components

As a customer,
I want the site's persistent header, icons, and every interactive element to reflect the new Artisanal Warm visual identity,
So that the site feels cohesive and polished from the first thing I see on any page, not just on individual redesigned screens.

**Acceptance Criteria:**

**Given** the current Tailwind config (`tailwind.config.ts`) defines only a single `brand` color with no typography, spacing, radius, or shadow scale
**When** this story ships
**Then** the token layer defines the full `DESIGN.md` frontmatter token set (Terracotta & Olive colors, Georgia/system-sans typography roles, rounded/spacing/shadow scales) so every later story references named tokens instead of ad-hoc hex/px values — see `DESIGN.md#Colors`, `#Typography`, `#Layout & Spacing`, `#Shapes`, `#Elevation & Depth`

**Given** `src/components/Navbar.tsx`'s cart link today renders bare "Cart" text plus an unlabeled count `<span>`, with no `aria-label` on the link
**When** this story ships
**Then** it's replaced with `DESIGN.md`'s `header-cart-pill` component (hand-drawn basket icon, cream pill, terracotta count badge) — see `DESIGN.md#Components`
**And** the link gains `aria-label="Cart, {count} items"` and the icon gains `aria-hidden="true"` — this is new accessibility work being added, not an existing pattern being preserved (per `EXPERIENCE.md#Accessibility Floor`)

**Given** emoji glyphs (🛒 🕐 🍞 🥕, confetti/celebration emoji) appear nowhere in the approved direction — Jeff explicitly rejected them during UX discovery
**When** this story ships
**Then** a reusable set of hand-drawn-style inline-SVG icon components exists, matching `DESIGN.md`'s `icon-line` token (basket, clock, wheat, leaf, checkmark)
**And** `ProductCard.tsx`'s existing no-image fallback icon is confirmed or updated to match this same stroke-based line-art style, so no two icon styles coexist in the app

**Given** no interactive element in the app currently has a documented focus-visible treatment
**When** this story ships
**Then** a reusable `focus-ring` utility (terracotta outline, per `DESIGN.md#Components`) exists and is applied to the header cart-pill link built in this story
**And** later stories (8.2-8.5) apply the same utility to their own interactive elements as they're built — this story only needs to prove the utility works on one real element, not retrofit the whole app

**Given** `DESIGN.md#Do's and Don'ts` documents two known mock-drift spots (a near-duplicate `sold-out-bg` hex value, and a couple pixels of spacing drift between the vendor page and cart mocks)
**When** this story ships
**Then** the token layer defines only the canonical values from `DESIGN.md`'s frontmatter — the drifted mock values are never carried into code

*(FR19, UX-DR1, UX-DR2, UX-DR7, UX-DR8, UX-DR9 (token). Foundation story — 8.2 through 8.5 depend on the token layer and shared components this story builds, but this story itself depends on nothing else in this epic.)*

### Story 8.2: Homepage redesign

As a customer visiting the homepage,
I want to see vendor cards in the new Artisanal Warm style with the whole card clickable,
So that browsing feels inviting and I don't have to aim for a small button just to view a vendor's menu.

**Acceptance Criteria:**

**Given** `VendorCard.tsx` today already wraps name/description/item-count in one `<Link>` to the vendor page
**When** this story ships
**Then** it's restyled per `DESIGN.md#Components`'s `vendor-card` definition (card-panel base, accent panel, "View menu" visual label, hover state) while preserving the existing whole-card-is-a-link behavior
**And** no `<button>` or other separate interactive element is introduced inside the card — the "View menu" text is presentational only, matching `EXPERIENCE.md#Component Patterns`'s explicit "no dead decorative buttons" rule

**Given** `Vendor` has no category/type field in the data model (Decided 2026-08-30, see `deferred-work.md`: a real `Vendor.category` field is deferred to a future epic, out of scope for this visual-only epic)
**When** any vendor card renders, regardless of what that vendor sells
**Then** it uses one universal accent-panel treatment (same gradient, same accent icon) — no per-vendor category differentiation, since there's no real data to differentiate on

**Given** the homepage's persistent header (built in Story 8.1) and the card's own interactive link
**When** a keyboard user tabs through the page
**Then** every vendor card and the header cart-pill are reachable via `Tab` and activatable via `Enter`, with the `focus-ring` utility visible on each — no hover-only affordances (per `EXPERIENCE.md#Interaction Primitives`)

*(FR19, UX-DR3.)*

### Story 8.3: Vendor page redesign

As a customer viewing a vendor's storefront page,
I want to see the vendor's menu presented with real visual warmth — a hero photo, a clear pickup-time banner, and inviting product listings,
So that the page feels like a real bakery's own menu, not a generic template.

**Acceptance Criteria:**

**Given** `src/app/vendors/[slug]/page.tsx` today renders a plain heading, description, and a flat list of product rows
**When** this story ships
**Then** the page is restyled per `DESIGN.md#Components`: a hero photo section with `caption-plate` (deterministic-contrast caption chip, not relying on gradient/shadow alone), the `pickup-banner` (terracotta gradient, hand-drawn clock icon), the `squiggle-divider`, and product rows using `circular-thumb` placeholders — see `DESIGN.md#Components`

**Given** a product's `stockQuantity <= 0` (out of stock)
**When** its row renders
**Then** the existing sold-out treatment (disabled "Add to cart", grayscale thumb) is preserved and restyled to match `button-pill-disabled` and `badge-negative` "Sold Out" — the underlying availability logic (`isInStock()`) is unchanged, only its visual presentation

**Given** the vendor's `deletedAt` is set (deactivated vendor, per Story 2.3's existing behavior — the route still returns a real 200, not a 404)
**When** a customer visits that vendor's page
**Then** the "This vendor is no longer available" message renders in the new typography (`DESIGN.md`'s `display-lg` heading style) rather than plain unstyled text — behavior is unchanged, only presentation

**Given** the page's interactive elements (Add to cart buttons)
**When** a keyboard user tabs through the page
**Then** each is reachable and shows the `focus-ring` utility from Story 8.1

*(FR19, UX-DR4.)*

### Story 8.4: Cart and checkout redesign

As a customer reviewing my cart and checking out,
I want the cart page laid out clearly with my items, total, and the checkout form easy to complete,
So that finishing my order feels straightforward rather than like scrolling through one long plain form.

**Acceptance Criteria:**

**Given** `src/app/cart/page.tsx` today renders one long single-column stack (items, then total, then name/phone/pickup-time/checkout)
**When** this story ships
**Then** the page splits into the two-column layout from `DESIGN.md#Layout & Spacing` (items + total on the left, a grouped contact/pickup-time/checkout panel on the right) — no change to what data is collected or when checkout is enabled

**Given** the existing quantity stepper (`−`/count/`+` buttons) and "remove" link
**When** this story ships
**Then** they're restyled per `DESIGN.md#Components` (pill-shaped stepper, `field-border` token) while preserving their existing behavior exactly: `−` disabled at qty 1, `+` disabled at `stockQuantity`, `aria-live="polite"` on the quantity value — this is a **regression guard**, not new work; the visual mock must not tempt a rebuild of these as non-interactive styled divs

**Given** the pickup-time picker's existing states (loading, error, empty, one slot auto-selected, 2+ slots as a real `<fieldset>`/`<legend>`/radio-input group, a full slot disabled)
**When** this story ships
**Then** each state is restyled per `EXPERIENCE.md#State Patterns` and `DESIGN.md`'s `pickup-option` component, preserving the real `<fieldset>`/`<legend>`/radio-input group for 2+ options — no state is replaced with styled non-interactive divs

**Given** `cart/page.tsx`'s three dynamic error/warning messages (checkout error, pickup-times-fetch-failure, "no longer available — remove to continue") render today as plain `<p>` text with no announcement mechanism
**When** this story ships
**Then** all three gain `role="alert"` and `aria-live="polite"` — this is new work this story adds, per `EXPERIENCE.md#Accessibility Floor`, since all three can gate or block checkout and a screen-reader user currently gets no notification when one appears

**Given** the name and mobile-number input fields
**When** this story ships
**Then** they're restyled per `DESIGN.md`'s `input-field` component (`field-border`, `placeholder-text` tokens) — no new client-side validation is added; checkout stays gated on both fields being non-empty exactly as today

*(FR19, UX-DR5, UX-DR9 (applied), UX-DR10, UX-DR11.)*

### Story 8.5: Checkout-success redesign

As a customer who just completed an order,
I want a warm, clear confirmation that my order went through,
So that I know tomorrow's pickup is handled without having to parse a plain, generic "thank you" page.

**Acceptance Criteria:**

**Given** `src/app/checkout/success/page.tsx` today renders a plain centered heading, one paragraph, and a text link
**When** this story ships
**Then** it's restyled per `DESIGN.md#Components`: the `confirm-card` panel, the `check-badge` (olive-gradient circle with a hand-drawn checkmark), and a low-opacity scattered squiggle-divider flourish behind the card — never confetti, never an animated burst (per `EXPERIENCE.md#Interaction Primitives`)

**Given** this page is a stateless "thank you" with no access to real order details (the actual order record is created server-side by a Stripe webhook, independent of whether the customer's browser ever reaches this page — per `EXPERIENCE.md#Foundation`)
**When** this story ships
**Then** the page continues to render only the static confirmation message and a "Back to vendors" link — no order-summary content is added, since this page structurally cannot know if the webhook has processed yet

**Given** the "Back to vendors" link
**When** this story ships
**Then** it's restyled as a `button-pill-primary` and remains keyboard-reachable with the `focus-ring` utility visible

*(FR19, UX-DR6.)*
