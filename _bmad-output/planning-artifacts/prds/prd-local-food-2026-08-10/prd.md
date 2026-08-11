---
title: local-food — Admin & Inventory Expansion
status: final
created: 2026-08-10
updated: 2026-08-11
---

# PRD: local-food — Admin & Inventory Expansion
*Working title — confirm.*

## 0. Document Purpose

This PRD scopes nine requested capabilities for `local-food` (plus FR-13, added after finalization to close a gap the backfill decision (FR-12) surfaced — placeholder stock counts need a way to reach the vendor who owns the real number), a pickup-only Next.js food marketplace (Prisma/Postgres, Clerk auth, Stripe hosted checkout, Twilio SMS). It is written for the PM, the architect who takes it next, and downstream epic/story authors. Structure: Glossary-anchored vocabulary, features grouped with FRs nested and globally numbered, `[ASSUMPTION]` tags inline and indexed in §9. Technical-how (schema shapes, webhook timing) lives in `addendum.md`, not here.

**Grounding note:** before drafting, the existing codebase was checked against each requested feature. Findings that materially changed scope, called out inline: cart-item-removal (FR-1) is **already implemented** — see §6.2; admin-adds-products (confirmed by user to mean the existing vendor self-service form) is likewise **already implemented**, no FR needed; in-place cart quantity adjustment (FR-11) is genuine net-new work added during review. The platform currently has **no admin role, no stock-quantity field, and no tax/shipping logic** (§4.2–§4.4, §5).

## 1. Vision

Today `local-food` lets a vendor self-serve their own storefront: list products, take pickup orders, get paid via Stripe. This expansion adds a **platform-admin layer** on top (onboard/offboard vendors) and a **real inventory system** underneath (numeric stock instead of a manual on/off switch), so the app can tell customers what's actually available and tell admins when it's running low — without anyone hand-tracking counts in a spreadsheet.

## 2. Target User

### 2.1 Jobs To Be Done
- As the **platform operator**, I need to onboard and offboard vendors myself, not rely on each vendor self-registering.
- As the **platform operator**, I need to see and act on stock levels across vendors without asking each vendor to check.
- As a **customer**, I need to trust that what's in my cart is actually available, and get an accurate total as I edit it.
- As a **vendor**, I need my stock to stay correct automatically after a sale, without a manual reconciliation step.

### 2.2 Key User Journeys

- **UJ-1. Admin removes a vendor who's gone quiet.** Admin, logged into the admin area, opens the vendor list, finds a vendor with no activity in months, and deactivates them. Their storefront now shows "no longer available"; their existing orders keep getting fulfilled normally.
- **UJ-2. Customer edits a cart before checkout.** Customer adds two items from one vendor, changes their mind on one, removes it, and sees the total drop by exactly that line's price before paying. *(Already works today — see §4.1.)*
- **UJ-3. Admin gets a heads-up before a vendor sells out.** A product's stock crosses the low-stock threshold. Admin gets a text within minutes, checks the dashboard, and nudges the vendor to restock.

*Lighter dial used per hobby/solo stakes — JTBD-level detail, no multi-screen flow diagrams.*

## 3. Glossary

- **Admin** — A platform-operator identity, distinct from a Vendor account. Not tied to any single vendor's storefront. New concept — does not exist in the system today.
- **Vendor** — An existing concept: one seller, 1:1 with a Clerk user, owns Products, Orders, PickupSlots.
- **Product** — Something a Vendor sells. Currently has `isAvailable: Boolean` only.
- **Stock Quantity** — New numeric count of units available for a Product. Replaces `isAvailable` as the source of truth; `isAvailable` becomes derived (true when Stock Quantity > 0).
- **Low-Stock Threshold** — A per-product number, set at product creation (via the existing `AddProductForm`), below which a Product triggers a Low-Stock Alert.
- **Low-Stock Alert** — An SMS sent to Admin when a Product's Stock Quantity crosses at or below its Low-Stock Threshold.
- **Inventory Report** — An admin-facing dashboard page showing current Stock Quantity across all Products, viewed on demand.
- **Cart** — Existing client-side, single-vendor-at-a-time collection of line items, held in `CartProvider`.

## 4. Features

### 4.1 Cart Item Management
**Description:** Customer can remove a line item from their cart, and adjust a line's quantity in place, with the total always correct. Line removal (`CartProvider.removeItem`, `totalCents` via `useMemo`, wired into `/cart`'s remove button) is **already implemented**. In-place quantity adjustment is net-new — today `addItem` only ever adds +1 or creates a fresh line at qty 1; there is no stepper. No shipping or tax exists anywhere in the codebase, and none is being added — confirmed price-only scope.

**Functional Requirements:**

#### FR-1: Customer can remove a cart line item and see an accurate total
Customer can remove any single line item from their cart before checkout. Realizes UJ-2.

**Consequences (testable):**
- Removing a line item drops it from the cart display immediately.
- Total shown equals the sum of `priceCents × quantity` for all remaining lines (no tax, no shipping).
- Removing the last item returns the cart to its empty state.

**Out of Scope:** Tax and shipping calculation (not present in the system; see §5).

**Notes:** `[NOTE FOR PM]` This FR is satisfied by existing code. Recommend the downstream epic scope it as a regression-test/harden task (confirm behavior under the new Stock Quantity checks in FR-6), not new development.

#### FR-11: Customer adjusts a cart line's quantity in place
Customer can increase or decrease a line item's quantity directly (e.g. 3→2, 2→1, 4→5) via a stepper next to the line, without removing and re-adding it. Realizes UJ-2.

**Consequences (testable):**
- Stepper decreases quantity one unit at a time, floor of 1 — going below 1 is not possible via the stepper; full removal still uses the existing remove control (FR-1).
- Stepper increases quantity one unit at a time, capped at the Product's Stock Quantity (§4.4) once inventory tracking lands — a customer cannot step past what's actually available.
- Total recalculates immediately on every adjustment, same `totalCents` mechanism as FR-1.

**Out of Scope:** Free-text quantity entry (stepper only, v1).

### 4.2 Admin Identity
**Description:** A new Admin role, distinct from Vendor accounts, gates the capabilities in §4.3–§4.4. `[ASSUMPTION: single flat Admin role, no tiers/permissions — matches hobby/solo stakes. Mechanism (Clerk role claim vs. allowlist) is an architecture decision, not specified here.]`

**Functional Requirements:**

#### FR-2: Admin-gated access
The system restricts vendor-management, cross-vendor product-management, and inventory-report/alert capabilities to users holding the Admin role.

**Consequences (testable):**
- A non-admin (customer or vendor) hitting an admin route/action is denied.
- An admin action taken on a vendor is attributable to that admin (basic audit — who did it). `[ASSUMPTION: storage mechanism (log table, audit field) is an architecture decision — no schema exists for this today.]`

**Out of Scope:** Multiple admin permission tiers. Admin self-service signup (admins are provisioned out-of-band).

### 4.3 Admin Vendor Management
**Description:** Admin can onboard a new vendor and remove an existing one. Today only vendors self-register (1:1 Clerk user ↔ Vendor); this adds an admin-driven path.

**Functional Requirements:**

#### FR-3: Admin adds a vendor
Admin can create a new Vendor record (name, slug, contact info) on the platform. Realizes UJ-1 (inverse).

**Consequences (testable):**
- New vendor appears in the platform vendor list and gets its own storefront at `/vendors/{slug}`.
- Slug collisions are rejected with a clear error, not a raw DB constraint failure (closes an existing known gap noted in project context).

#### FR-4: Admin deletes a vendor
Admin can deactivate a Vendor. This is a soft-delete: the vendor stops being orderable, but existing Orders survive and must still be fulfilled. Realizes UJ-1.

**Consequences (testable):**
- Deleted vendor's storefront (`/vendors/{slug}`) shows a clear "this vendor is no longer available" message instead of a blank 404 or an ordering page.
- No new Order can be placed against a deleted vendor — checkout is blocked server-side, not just hidden client-side.
- Orders placed *before* deletion (any non-terminal status) proceed through their normal fulfillment lifecycle unchanged — pickup, SMS notification, status updates all continue to work.
- Deleted vendor's Products are **not** removed — they're still referenced by existing OrderItems and must remain queryable for order history/fulfillment. They simply become unorderable (same mechanism as an out-of-stock or unavailable product, extended to vendor-level).

**Out of Scope:** Vendor self-deletion. Reactivation/undo of a deleted vendor. Hard delete of the underlying Vendor/Product/Order records (soft-delete only, v1).

### 4.4 Inventory Tracking
**Description:** Replaces the manual `isAvailable` toggle with a real Stock Quantity that drives storefront display, cart eligibility, post-sale decrement, and admin alerting/reporting. This is the biggest net-new piece — five of the nine requested features live here.

**Functional Requirements:**

#### FR-6: Out-of-stock products are visibly marked
Customer sees a clear out-of-stock indicator on any Product whose Stock Quantity is 0, everywhere that product is displayed (storefront listing, product detail).

**Consequences (testable):**
- Out-of-stock Products render a visible badge/label, not just an absence of an "add to cart" button.
- Badge state matches current Stock Quantity (no stale cache showing in-stock after it hits 0).

#### FR-7: Out-of-stock products cannot be added to the cart
Customer cannot add a Product with Stock Quantity 0 to their cart. Realizes UJ-2 boundary.

**Consequences (testable):**
- "Add to cart" is disabled/absent for out-of-stock Products client-side.
- Server-side checkout re-validates Stock Quantity ≥ requested quantity at order-creation time (never trust client state — matches existing "never trust client-sent prices" discipline).
- A product that goes out of stock *while already in someone's cart* is caught at checkout, not silently allowed through.

#### FR-8: Inventory updates immediately when a sale completes
When an Order is confirmed as paid, each line item's Product Stock Quantity decrements by the ordered quantity.

**Consequences (testable):**
- Decrement happens on payment confirmation (Stripe webhook), not at checkout-session creation — an abandoned/expired Stripe session must not decrement stock.
- Stock Quantity never goes negative; a race between two simultaneous last-unit purchases resolves to one success, one rejection.
- Stock Quantity hitting 0 flips the Product's out-of-stock state (FR-6, FR-7) without a separate manual step.

#### FR-9: Admin Inventory Report
Admin can view current Stock Quantity across all Products, across all vendors, on an Inventory Report dashboard page.

**Consequences (testable):**
- Page reflects current Stock Quantity at request time (Server Component fetch, matches existing dashboard pattern — no caching staleness).
- Low-stock and out-of-stock Products are visually flagged in the list.
- Page is reachable only to Admin (FR-2 gate).

**Out of Scope:** Scheduled/pushed delivery (SMS or email) of this report — on-demand page only, v1.

#### FR-10: Low-inventory alert to admin
When a Product's Stock Quantity crosses at or below its Low-Stock Threshold, Admin receives an SMS alert. Realizes UJ-3.

**Consequences (testable):**
- Alert fires once per crossing event, not repeatedly while stock stays low (no spam on every subsequent sale below threshold).
- Alert reuses the existing `sendSms` pattern; a failed send does not silently mark the alert as delivered (mirrors the existing `smsNotified` discipline).

#### FR-12: Stock Quantity is set at creation and backfilled for existing Products
`AddProductForm` gains a Stock Quantity input, and existing Products (which today have only `isAvailable`, no numeric count) get a defined starting value when this field is introduced.

**Consequences (testable):**
- New Products require a Stock Quantity value at creation (via `AddProductForm`, vendor self-service) or FR-3-adjacent admin flows — no Product exists without one going forward.
- Every pre-existing Product is backfilled on migration: `isAvailable: true` → Stock Quantity 100 (fixed placeholder — avoids instantly zeroing out every existing storefront); `isAvailable: false` → Stock Quantity 0. Vendors correct the real count afterward (see FR-13).
- Low-Stock Threshold (§3) is likewise set on `AddProductForm` at creation, per-product, with the same backfill consideration for existing Products.

#### FR-13: Vendor is notified of a placeholder Stock Quantity and prompted to update it
Vendor sees a banner/flag on their `/dashboard/products` page for any Product whose Stock Quantity still equals the migration placeholder (FR-12), prompting them to enter the real count.

**Consequences (testable):**
- Banner/badge appears next to any Product row where Stock Quantity equals the placeholder value, on the vendor's own products dashboard.
- Banner disappears the moment the vendor edits that Product's Stock Quantity to any value.
- No SMS, email, or other push — dashboard-only, matches the existing vendor self-service surface (no new notification channel).

**Out of Scope:** Distinguishing "genuinely re-entered the placeholder value" from "never touched" — any edit clears the flag, even a no-op edit back to the same number.

**Feature-specific NFRs:**
- Stock Quantity changes (decrement, threshold check) must be consistent under concurrent orders — no overselling the last unit.

**Notes:** `[NOTE FOR PM]` FR-8 (decrement) and FR-10 (low-stock alert, fired on the same decrement event) depend on the Stripe webhook handler — no scheduling infra needed. FR-9 is now an on-demand page, likewise no scheduling infra needed — the daily-cadence framing was dropped when SMS-push was replaced with a dashboard page.

## 5. Non-Goals (Explicit)

- **Tax and shipping calculation** — not present in the codebase (pickup-only model), not being added by this PRD.
- **Multiple admin permission tiers** — one flat Admin role, v1.
- **Vendor self-deletion** — Admin-only.
- **Vendor reactivation/undo once deleted** — deletion is one-way, v1.
- **Hard delete of Vendor/Product/Order records** — deletion is soft (deactivation), not row removal, so order history and fulfillment survive.
- **Push notifications beyond the low-stock alert** — FR-9 is an on-demand page, not a push; FR-10 is the only SMS push in scope.
- **Inventory forecasting, reorder suggestions, or supplier integration** — out of scope; this is tracking and alerting only.

## 6. MVP Scope

### 6.1 In Scope
- In-place cart quantity stepper (FR-11)
- Admin role + gating (FR-2)
- Admin vendor add/delete (FR-3, FR-4)
- Stock Quantity field replacing manual `isAvailable` toggle (FR-6–FR-10)
- Out-of-stock UI marking + cart blocking, client and server (FR-6, FR-7)
- Post-sale stock decrement via webhook (FR-8)
- Admin inventory dashboard page (FR-9)
- Low-stock SMS alert (FR-10)
- Stock Quantity creation input + existing-Product backfill (FR-12)
- Vendor placeholder-Stock-Quantity dashboard notification (FR-13)

### 6.2 Out of Scope for MVP
- Cart item removal + total recalc (FR-1) — **already implemented**, ships as a verification task, not new work.
- Admin adding products (originally FR-5) — confirmed this means the existing vendor self-service `AddProductForm`, **already implemented**, no new work. FR-5 is retired (not reassigned, per stable-ID discipline).
- Everything in §5 Non-Goals.

## 7. Success Metrics

*Hobby/solo scale — qualitative, not instrumented dashboards.*

- **Success**: Admin can fully onboard and offboard a vendor without touching the database directly.
- **Success**: A product hitting zero stock is reflected in the storefront and blocks checkout on the same request that attempts it — no window where a sold-out item is purchasable.
- **Counter-metric**: Low-stock alerts don't turn into noise — one alert per threshold crossing, not one per sale.

## 8. Open Questions

None outstanding — all resolved during Fast-path review (see `.memlog.md` for the decision trail).

## 9. Assumptions Index

- §4.2: Single flat Admin role, no permission tiers — matches hobby/solo stakes.
- §4.2: Admin provisioning mechanism (Clerk role claim vs. allowlist) deferred to architecture.
- §4.2 FR-2: Admin-action audit storage mechanism deferred to architecture — no schema exists for this today.
