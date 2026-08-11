---
title: Adversarial Review — Architecture Spine (local-food Admin & Inventory Expansion)
target: _bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
prd: _bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md
method: adversarial — construct pairs of stories/PRs that each obey every AD to the letter yet build incompatibly
date: 2026-08-10
---

# Adversarial Review — Architecture Spine

**Method.** For each AD, look for the gap between what it *says* (the literal rule) and what it's *supposed to prevent* (the stated intent). Where a builder could satisfy the letter while defeating the intent — or where two builders could each satisfy the letter and still collide — that's a hole. Findings are grounded in the actual repo state (`prisma/schema.prisma`, `src/lib/vendor.ts`, `src/middleware.ts`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/components/CartProvider.tsx`) as it exists today, not assumed.

**Result: 7 genuine holes**, ranked by severity.

---

## HOLE 1 (Critical) — FR-3's admin-created Vendor has no defined `clerkUserId`, and no AD addresses it

**The clash.** `Vendor.clerkUserId` is `String @unique`, **required, not nullable**, in the current schema (`prisma/schema.prisma:20`). Today there is *no* vendor-creation code path at all — `src/app/dashboard/page.tsx:12-17` literally tells the operator to hand-seed a `Vendor` row matching their Clerk id, or "wire up an onboarding form as a next step." FR-3 ("Admin adds a vendor") is about to become the **first real Vendor-creation path ever built**, and its field list is explicitly "name, slug, contact info" (PRD §4.3, FR-3) — no `clerkUserId`. The PRD's own JTBD frames this as admin onboarding vendors *instead of* self-registration ("not rely on each vendor self-registering"), meaning the admin is creating the row *before* that vendor has ever authenticated with Clerk.

**Why no AD closes it.** AD-1 only defines *Admin's* identity shape (`Admin.clerkUserId`). AD-5 only says attribution is a nullable FK at the point of action. The Capability→Architecture Map binds FR-3/FR-4 to AD-1, AD-4, AD-5, AD-6 — none of which say one word about how an admin-created `Vendor` row acquires its own `clerkUserId`, or how a real vendor later "claims" a storefront an admin created for them.

**Two compliant, incompatible builds:**
- **Story A** (admin-vendor-create): makes `clerkUserId` nullable so the admin form can insert a row without one, deferring population to an unspecified future "claim" step.
- **Story B** (admin-vendor-create, built independently or by a different agent): keeps the column required, and satisfies the NOT NULL/unique constraint with a placeholder (`"pending:" + cuid()`), planning to overwrite it "later." Nothing overwrites it — `getCurrentVendor()` (`src/lib/vendor.ts:14-16`) looks up by exact `clerkUserId` match against `auth().userId`, so a placeholder value can never match a real signed-in user. The vendor is permanently orphaned from their own storefront.

Both satisfy every AD in the spine to the letter. They produce different schema nullability, different migration shape, and — critically — **neither actually delivers a working "admin onboards a vendor" flow**, because neither resolves how the real human ends up signed in as that Vendor.

**Fix direction.** Add an AD (or extend AD-1) that states: (a) whether `Vendor.clerkUserId` becomes nullable for admin-created rows, and (b) the mechanism by which an admin-created Vendor becomes bound to a real Clerk identity (invite-token claim flow, admin sets it after the vendor signs up and reports their user id, etc.). This is architecturally load-bearing — it's a schema nullability decision plus a new state transition, not an implementation detail.

---

## HOLE 2 (Critical) — FR-11's stock ceiling has no owner: capability map says "unchanged," but the cap requires new client state with an unspecified freshness contract

**The clash.** `CartProvider.tsx`'s `CartItem` type (`src/components/CartProvider.tsx:18-23`) has exactly `{ productId, name, priceCents, quantity }` — no stock field. FR-11 requires the stepper to cap increments "at the Product's Stock Quantity" (PRD §4.1, FR-11). That number has to live *somewhere* in client state for the stepper to enforce it without a network round-trip per click. But the spine's Capability→Architecture Map row for FR-1/FR-11 says only: *"governed by Paradigm (client-side state, unchanged)"* — which is simply false once FR-11 ships; the paradigm doesn't mention a stock cap, and "unchanged" tells a builder there's nothing new to design here.

**Why no AD closes it.** AD-2 governs *read-site* availability computation (`stockQuantity > 0`) at the server. AD-3 governs *write* paths. Neither says anything about how a *quantity ceiling* value gets carried into client-side cart state, or how stale that value is allowed to become while a customer sits on `/cart` (the cart is pure in-memory React state — no refetch mechanism exists).

**Two compliant, incompatible builds:**
- **Story A**: extends `CartItem` with `stockQuantity: number`, captured once at `addItem()` time from whatever the listing page fetched, never refreshed. A customer who adds an item, then leaves the tab open while another customer buys out the stock, can still step up to a now-wrong ceiling.
- **Story B**: adds `maxQuantity: number` (different field name — a straight merge conflict with Story A on the same type) fetched fresh via a client call to `/api/products/[id]` on every stepper mount.

Neither violates AD-2 or AD-3 (both still rely on FR-7's server-side checkout re-check as the real backstop), but they ship different `CartItem` shapes, different component contracts, and different staleness guarantees — and the spine gives a builder no signal that this is even a decision to make, let alone which answer is correct.

**Fix direction.** Add a rule (new AD or an amendment to AD-2) that states the stepper's client-side ceiling is advisory only, names the field it's carried in, and states explicitly that FR-7's server-side check at checkout is the sole point of truth — with a defined UX for what happens when the server rejects a quantity the stepper allowed (currently: checkout returns a flat "one or more items are unavailable," `src/app/api/checkout/route.ts:31-36`, which doesn't distinguish "gone entirely" from "you asked for more than we have").

---

## HOLE 3 (Critical) — the "one write path" of AD-3 doesn't close the race across a multi-item order, or define what happens when it loses after the customer already paid

**The clash.** FR-8 requires: "each line item's Product Stock Quantity decrements by the ordered quantity" and "a race between two simultaneous last-unit purchases resolves to one success, one rejection." But by the time the webhook fires, **Stripe has already taken the customer's money** (`src/app/api/webhooks/stripe/route.ts:41-50` marks the order `PAID` on `checkout.session.completed` — payment is a fait accompli). AD-3's conditional-update rule ("`UPDATE ... WHERE stockQuantity >= :delta`, checking rows-affected") describes a single-row, single-call primitive. An order can have multiple `OrderItem`s across multiple products. AD-3 never states:
1. Whether the webhook's per-item `adjustStock()` calls are wrapped in one DB transaction, or run independently in a loop.
2. What happens when `adjustStock()` returns "0 rows affected" (insufficient stock) for item 2 of 3, when item 1 already decremented successfully — does the order still get marked `PAID`? Does item 1's decrement get rolled back? Is there a refund path?

**Why this matters:** this is precisely the case AD-3's own "Prevents" clause claims to close ("two independently-built call sites... racing on the last unit") — but that clause is about *two different call sites* (e.g. webhook vs. a future admin edit form) never racing each other. It says nothing about the *webhook losing its own race against itself* across an order's line items, or about the state left behind when the money is already captured but the inventory can't cover it.

**Two compliant, incompatible builds:**
- **Story A**: loops `for (item of order.items) await adjustStock(...)` with no transaction wrapper; on a failed item, logs and continues — order ends up `PAID` with an unfulfillable line, silently.
- **Story B**: wraps the loop in `prisma.$transaction(...)`; on any item's failure, throws, and the *whole webhook handler* throws — Stripe will retry the webhook (Stripe's own semantics), re-attempting a decrement against an order that's already partially processed, and re-sending the confirmation SMS check (`smsNotified` guards the SMS, but not the stock decrement, which isn't idempotent-guarded the way `smsNotified` is).

Both satisfy AD-3's literal text about the conditional update. Neither is told what "rejection" should look like once payment has already succeeded — the PRD's own FR-8 language ("one success, one rejection") implicitly assumes the race is caught *before* money changes hands, but the architecture's chosen flow (decrement on webhook, after Stripe payment) makes that impossible to guarantee.

**Fix direction.** AD-3 needs an explicit clause for the multi-item/post-payment case: either (a) mandate a pre-payment stock hold/reservation at checkout-session creation (a bigger change), or (b) explicitly accept oversell-after-payment as possible and specify the recovery path (mark order `PARTIALLY_UNFULFILLABLE`, trigger a refund, flag for admin) rather than leaving it to whichever builder happens to write the webhook loop.

---

## HOLE 4 (Medium-High) — AD-1/AD-5's Admin↔Vendor FK has no specified referenced field

**The clash.** The prompt's own suspicion is confirmed. AD-1 gives `Admin` two unique-able fields once Prisma conventions are followed: a `cuid()` primary key `id` (every other model — `Vendor`, `Product`, `Order` — uses this shape) and `clerkUserId String @unique`. AD-5 says attribution is "a nullable FK column... e.g. `Vendor.deletedByAdminId`, `Vendor.createdByAdminId`." The Structural Seed ERD draws `Admin ||--o{ Vendor` and labels the fields `"nullable FK -> Admin"` — but a Prisma `@relation` can legally target *either* unique field on `Admin`, and the spine never states which.

**Two compliant, incompatible builds:**
- **Story A** (FR-3, admin-create-vendor): follows the existing schema convention every other FK uses (`vendorId` → `Vendor.id`, `productId` → `Product.id`) and stores `admin.id` (cuid) in `createdByAdminId`.
- **Story B** (FR-4, admin-delete-vendor, built separately): reasons from AD-1's own words — "`Admin.clerkUserId` ... is the sole source of admin identity" — and, since `getCurrentAdmin()` resolves off `clerkUserId`, stores the raw Clerk user id string in `deletedByAdminId`.

Both fields look identical in the schema (`String?`), both satisfy AD-5's letter ("nullable FK column... at the point of action"), and nothing — not a type system, not a DB constraint — catches the mismatch until someone tries to join `Vendor.createdByAdminId` and `Vendor.deletedByAdminId` against the same `Admin` table and gets inconsistent results depending on which column they used.

**Fix direction.** State explicitly in AD-1 or AD-5: "attribution FKs reference `Admin.id`, consistent with every other FK in the schema (`vendorId`, `productId`, etc.) — never `Admin.clerkUserId`."

---

## HOLE 5 (Medium) — AD-2 bans one column by name, not the pattern; a differently-named cached flag drifts the same way

**The clash.** AD-2's rule: *"The `Product.isAvailable` column is dropped."* That's a ban on a specific identifier, not a ban on the general shape "a stored boolean/derived field that mirrors `stockQuantity`." Nothing stops a later story — reasonably motivated by FR-9's Inventory Report wanting to flag low/out-of-stock products efficiently, or FR-10's alerting logic — from adding `Product.inStock` or `Product.isLowStock` "for performance" (e.g. to avoid a computed `WHERE` on every storefront listing query, even though Postgres can trivially index `stockQuantity` itself and this "performance" motivation doesn't hold up). AD-3 only locks *`lowStockAlerted`* by name into `adjustStock()`'s exclusive control ("The same function flips `lowStockAlerted`... within the same call") — any newly-invented column isn't named there either, so nothing requires a future cached field to be written exclusively inside `adjustStock()`. A builder could reasonably (and compliantly) write it from wherever they add the "performance" optimization, and it drifts the moment any other write path touches `stockQuantity`.

**Fix direction.** Generalize AD-2's rule from "the `isAvailable` column is dropped" to "no stored field derives from or mirrors `stockQuantity`'s availability state; all such fields are computed at read time" — closing the pattern, not just the one identifier — and extend AD-3's "same function" clause to cover *any* future derived column, not just `lowStockAlerted` by name.

---

## HOLE 6 (Medium) — AD-6 gates route *location* correctly, but not route *matcher registration*, leaving a forgettable per-route step

**Note:** AD-6's core question from the prompt — can FR-9 get built under `/dashboard` instead of `/admin`? — is actually well-closed: AD-6's rule text and the Structural Seed's file tree both explicitly place `FR-9` at `src/app/admin/inventory/`. This is not a hole. But there's a related gap one level down.

**The clash.** AD-6's rule requires every new admin route be "added to `middleware.ts`'s `isProtectedRoute` matcher" (currently `createRouteMatcher(["/dashboard(.*)"])`, `src/middleware.ts:8`) *and* call `getCurrentAdmin()`. This is additive and per-route by construction — AD-6 doesn't mandate a single blanket `"/admin(.*)"` entry covering the whole future tree. So each of FR-3 (`/admin/vendors`), FR-9 (`/admin/inventory`), and any future admin route requires its own matcher-array edit, in its own story/PR, to the same shared file. A builder who satisfies AD-6's "`getCurrentAdmin()` call" requirement (which does its own hard gate) can plausibly reason the middleware matcher edit is redundant belt-and-suspenders and skip it — and nothing in the spine flags that skip as a violation of intent, only of a checklist item easy to miss across parallel PRs touching the same array.

**Fix direction.** Change AD-6's rule to a single blanket entry — `isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"])` — added once, so no future admin route ever needs a middleware edit to get the authenticated-gate layer. This removes the per-PR forgettable step entirely rather than relying on every future builder remembering it.

---

## HOLE 7 (Low-Medium) — migration ordering between FR-12's backfill and AD-2's column drop is unspecified

**The clash.** FR-12's backfill logic is explicitly deferred as a product decision ("`[NOTE FOR PM]` the actual default... is a product decision, not resolved in this PRD") and plausibly depends on each product's *current* `isAvailable` value (true → some default, false → 0) — the PRD says as much. AD-2 says the column "is dropped." Neither the PRD note nor AD-2 states that the backfill read must happen *before* (or in the same migration as) the drop. If FR-12 (add `stockQuantity` + backfill) and the AD-2-driven read-site rewrites (drop `isAvailable`, rewrite `checkout`/storefront queries) ship as separately-ordered PRs/stories, a builder could merge the "drop `isAvailable`" change first — compliant with AD-2's letter — destroying the exact signal (`isAvailable: true/false`) the backfill was supposed to read, before `stockQuantity` exists to receive it.

**Fix direction.** State explicitly (in AD-2 or as a new note) that the backfill and the column drop are one migration, or that the drop is strictly ordered after a verified backfill — not left to PR sequencing.

---

## Summary Table

| # | Hole | Severity | ADs implicated | Type |
|---|------|----------|-----------------|------|
| 1 | Admin-created Vendor's `clerkUserId` binding unspecified | Critical | AD-1, AD-5 (capability map) | FR not actually covered |
| 2 | FR-11 stock-ceiling shape/freshness unowned | Critical | AD-2 (capability map says "unchanged") | Shared-data shape clash |
| 3 | Multi-item webhook decrement race / post-payment failure path | Critical | AD-3 | Race the AD doesn't close |
| 4 | Admin↔Vendor attribution FK target field unspecified | Medium-High | AD-1, AD-5 | Two owners, no contract |
| 5 | `isAvailable`-shaped cache re-emerges under a new name | Medium | AD-2, AD-3 | Letter-vs-intent loophole |
| 6 | Middleware matcher registration is per-route, forgettable | Medium | AD-6 | Process gap, not location gap |
| 7 | Backfill-vs-column-drop migration ordering unspecified | Low-Medium | AD-2, FR-12 | Sequencing gap |
