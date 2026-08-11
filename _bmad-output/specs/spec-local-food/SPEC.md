---
id: SPEC-local-food
companions:
  - glossary.md
  - ../../planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
  - ../../project-context.md
sources:
  - ../../planning-artifacts/prds/prd-local-food-2026-08-10/prd.md
  - ../../planning-artifacts/prds/prd-local-food-2026-08-10/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# SPEC: local-food — Admin & Inventory Expansion

## Why

**local-food** is a pickup-only Next.js food marketplace where a Vendor self-serves their own storefront — list products, take pickup orders, get paid via Stripe — but the platform has no operator layer above that: no way for an admin to onboard or remove a vendor, and stock is tracked only by a manual `isAvailable` on/off toggle. This is a pain to solve (the platform operator has no vendor-lifecycle tooling) combined with a vision to realize (a real numeric inventory system that tells customers what's actually available and tells admins when it's running low, without anyone hand-tracking counts in a spreadsheet).

## Capabilities

- **CAP-1** *(FR-1)*
  - **intent:** Customer can remove a line item from their cart.
  - **success:** Removing a line drops it immediately and the total recalculates to the remaining lines only. Already implemented in `CartProvider`/`/cart` — this capability ships as a verification/regression task, not new development.

- **CAP-2** *(FR-2)*
  - **intent:** The system restricts admin capabilities (vendor management, cross-vendor product management, inventory report and alerts) to users holding the Admin role.
  - **success:** A non-admin hitting an admin route or action is denied. An admin action taken on a vendor is attributable to the acting admin.

- **CAP-3** *(FR-3)*
  - **intent:** Admin can onboard a new vendor onto the platform.
  - **success:** The new vendor appears in the platform vendor list with a live storefront at `/vendors/{slug}`. A slug collision is rejected with a friendly error, not a raw DB constraint failure.

- **CAP-4** *(FR-4)*
  - **intent:** Admin can deactivate a vendor.
  - **success:** The deactivated vendor's storefront shows a clear "no longer available" message; no new order can be placed against it. Orders already placed continue their normal fulfillment lifecycle unchanged. Vendor and Product records are not deleted.

- **CAP-5** *(FR-6)*
  - **intent:** Customer sees a clear out-of-stock indicator on any product with zero Stock Quantity.
  - **success:** A visible badge/label renders everywhere the product is displayed (listing and detail), matching current Stock Quantity with no stale in-stock display.

- **CAP-6** *(FR-7)*
  - **intent:** Out-of-stock products cannot be added to the cart or carried through checkout.
  - **success:** "Add to cart" is disabled client-side for a zero-stock product. Checkout re-validates Stock Quantity sufficiency per line server-side and rejects the whole order if any line is short — never trusting client state.

- **CAP-7** *(FR-8)*
  - **intent:** Inventory updates immediately when a sale completes.
  - **success:** Stock Quantity decrements on payment confirmation (webhook), not at checkout-session creation. It never goes negative; two customers racing for the last unit resolve to exactly one success and one rejection.

- **CAP-8** *(FR-9)*
  - **intent:** Admin can view current Stock Quantity across all vendors, on demand.
  - **success:** A dashboard page reflects live Stock Quantity at request time, visually flags low-stock and out-of-stock products, and is reachable only to Admin.

- **CAP-9** *(FR-10)*
  - **intent:** Admin receives an SMS alert when a product's Stock Quantity crosses at or below its Low-Stock Threshold.
  - **success:** The alert fires once per crossing event, not repeatedly while stock stays low. A failed SMS send is never recorded as delivered.

- **CAP-10** *(FR-11)*
  - **intent:** Customer can adjust a cart line's quantity in place via a stepper, without removing and re-adding it.
  - **success:** The stepper moves quantity between a floor of 1 and a ceiling of available Stock Quantity; the total recalculates on every adjustment.

- **CAP-11** *(FR-12)*
  - **intent:** Stock Quantity is captured at product creation and backfilled for every product that predates it.
  - **success:** No Product can be created without a Stock Quantity going forward. On migration, every pre-existing Product with `isAvailable: true` is backfilled to a fixed placeholder count (100); every `isAvailable: false` Product is backfilled to 0. No storefront goes instantly empty on migration day.

- **CAP-12** *(FR-13)*
  - **intent:** Vendor is notified of a placeholder Stock Quantity on their own products and prompted to update it.
  - **success:** A banner appears on the vendor's `/dashboard/products` page for any Product still at the placeholder value; it disappears the moment the vendor edits that Product's Stock Quantity to any value. Dashboard-only — no SMS or email.

## Constraints

- Admin identity resolves solely through a new `Admin` table keyed by `clerkUserId` — never a Clerk session claim (ARCHITECTURE-SPINE.md AD-1).
- `Product.isAvailable` is dropped; availability and checkout sufficiency are computed at read time only — no persisted or cached boolean may re-derive it under any name (AD-2).
- Every write to `Product.stockQuantity` goes through one `adjustStock()` function using a conditional update, transactional across a multi-item order's lines (AD-3).
- Vendor-deactivated status is checked through one shared guard, `assertVendorActive()`, which throws rather than returns a boolean (AD-4).
- Admin action attribution is a plain FK field (e.g. `Vendor.deletedByAdminId`), not an audit-log table (AD-5).
- Admin pages live under `/admin/*`, gated by both the existing auth middleware and a new `getCurrentAdmin()` check (AD-6).
- Vendor slug collisions are checked via `resolveVendorSlug()`, scoped to the admin-create path only (AD-7).
- An admin-created vendor starts with `clerkUserId: null`; binding it to a real login is manual and out-of-band — no invite/claim flow is built (AD-8).
- No tax or shipping logic — pickup-only marketplace, confirmed out of scope.
- Money stays cents-based `Int` throughout; no floats (existing project convention).
- The migration placeholder is one named constant, `PLACEHOLDER_STOCK_QUANTITY`, shared by the backfill migration and the CAP-12 dashboard banner check — neither hardcodes the literal separately (AD-9).

## Non-goals

- Tax and shipping calculation.
- Multiple admin permission tiers — one flat Admin role.
- Admin self-service signup — admins are provisioned out-of-band, not through an in-app flow.
- Vendor self-deletion; reactivation/undo once a vendor is deactivated; hard delete of Vendor/Product/Order records.
- Free-text cart quantity entry — stepper only.
- Scheduled or pushed inventory reporting (SMS or email) beyond the low-stock alert — the Inventory Report is on-demand only.
- Inventory forecasting, reorder suggestions, or supplier integration.
- A vendor invite/claim flow automating the login-binding for an admin-created vendor.
- Auto-refund on a post-payment stock shortfall.

## Success signal

Admin can fully onboard and deactivate a vendor without ever touching the database directly. A product hitting zero stock blocks checkout on the same request that attempts it — no window where a sold-out item is purchasable. Low-stock alerts fire once per threshold crossing, not once per sale (no alert spam).
