# API Contracts

All routes live under `src/app/api/` (Next.js App Router route handlers). None use a shared response envelope — each returns `{ ...data }` or `{ error: string }` directly via `NextResponse.json`.

## Auth model

- **Vendor-scoped routes** (`products`, `pickup-slots`) call `getCurrentVendor()` (`src/lib/vendor.ts`), which reads the Clerk session and looks up the `Vendor` row by `clerkUserId`. No vendor row → `401 Unauthorized`. There is no separate authorization check beyond "does a Vendor row exist for this Clerk user" — a signed-in vendor can only ever see/write their own data because every query filters `where: { vendorId: vendor.id }`.
- **Admin-scoped routes/pages** (`/admin/*`, Story 2.1) call `getCurrentAdmin()` (`src/lib/admin.ts`), which reads the Clerk session and looks up the `Admin` row by `clerkUserId` — the same shape as `getCurrentVendor()`, a distinct identity/table. `src/app/admin/page.tsx` calls `notFound()` when no admin resolves; a future mutating admin route should return `401 Unauthorized` instead, mirroring the vendor-scoped routes' pattern.
- **Public routes** (`checkout`, `vendors/[vendorId]/pickup-slots`) take no auth — anyone can place an order against any `vendorId`, or list a vendor's upcoming pickup slots, which is the intended storefront behavior. `vendors/[vendorId]/pickup-slots` (Story 5.1) is the first unauthenticated `GET` route in this codebase — every other public route is a write (`checkout`); the data it returns (slot times/locations) is already shown publicly on the storefront's "Next pickup" banner, so no new trust boundary is opened.
- **Webhook route** (`webhooks/stripe`) authenticates the *caller* (Stripe) via HMAC signature (`stripe-signature` header + `STRIPE_WEBHOOK_SECRET`), not via Clerk.
- `middleware.ts` additionally hard-blocks unauthenticated access to `/dashboard(.*)` and `/admin(.*)` at the edge, before any page/route code runs.

---

### `POST /api/checkout`
Creates a `PENDING` order and a Stripe Checkout session.

**Request body** (validated by `CheckoutSchema`, Zod):
```ts
{
  vendorId: string,       // min length 1
  pickupSlotId: string,   // min length 1 — required (Story 5.1); no order can be created without one
  customerName: string,   // min length 1
  customerPhone: string,  // min length 5
  items: Array<{ productId: string; quantity: number /* positive int */ }>  // min 1 item
}
```

**Behavior:**
1. `req.json().catch(() => null)` then `safeParse` — malformed JSON or schema mismatch → `400 { error: "Invalid request" }`.
2. **Vendor lookup and active check (Story 2.3, AD-4), before the product query.** `prisma.vendor.findUnique({ where: { id: vendorId } })` — missing → `400 { error: "One or more items are unavailable" }` (the same message a missing/wrong-vendor product also produces, kept consistent). Found → `assertVendorActive(vendor)` in a `try/catch`; a deactivated vendor (`VendorDeactivatedError`) → `400 { error: "This vendor is no longer accepting orders" }`. Fails fast, before the product query below runs at all.
3. **Pickup slot lookup (Story 5.1, AC #2, NFR2), before the product query.** `prisma.pickupSlot.findFirst({ where: { id: pickupSlotId, vendorId } })` — not found (wrong vendor or since-deleted) → `400 { error: "Selected pickup time is no longer available" }`, a distinct message from the product-unavailable case below. "Still exists" means the row exists and belongs to this vendor, not that it hasn't started yet — no `startsAt` re-check at checkout time.
4. **Capacity check, immediately after the slot lookup.** `prisma.order.count({ where: { pickupSlotId: pickupSlot.id, status: { in: ["PENDING", "PAID"] } } })` — `PENDING` counts alongside `PAID`, not just `PAID`, since a customer mid-checkout (Stripe Checkout session open, not yet paid) has already claimed a spot. `bookedCount >= pickupSlot.capacity` → `400 { error: "Selected pickup time is full" }`, a distinct message from the slot-not-found case above. **Same point-in-time-check tradeoff as the stock sufficiency check below** — not an atomic reservation, does not itself prevent two concurrent checkouts from both passing for a slot's last spot.
6. Quantities are aggregated per `productId` first (a cart can list the same product on multiple lines), then the distinct products are re-fetched from the DB, filtered by `vendorId`. If the count doesn't match the number of distinct requested products (one is deleted or belongs to a different vendor), → `400 { error: "One or more items are unavailable" }`.
7. Stock sufficiency check: `stockQuantity >= totalRequestedQuantity` per product (architecture AD-2 — availability is computed from `stockQuantity`, not a stored boolean; totaled across duplicate lines for the same product). Any short product rejects the whole order → `400 { error: "One or more items don't have enough stock" }`, before anything is created. **This check is a point-in-time read with no reservation or transaction** — it does not itself prevent two concurrent checkouts from both passing for the same last unit. Stock itself is never written here; the actual decrement happens later, in `POST /api/webhooks/stripe`, only once Stripe confirms payment (Story 1.4) — see that route's contract below.
8. Computes `totalCents` from DB prices — the client-sent price (there is none in this schema) can never influence the charge.
9. Creates `Order` (status `PENDING`, `pickupSlotId` set to the validated slot — Story 5.1, AC #3) with nested `OrderItem` creates.
10. Creates a Stripe Checkout session (`mode: "payment"`), `metadata: { orderId }` so the webhook can find it back, `success_url` → `/checkout/success`, `cancel_url` → `/cart`.
11. Updates the `Order` with `stripeSessionId`.

**Response:** `200 { url: string }` — the Stripe-hosted checkout URL to redirect the browser to.

---

### `GET /api/vendors/[vendorId]/pickup-slots`
Lists a vendor's upcoming pickup slots, soonest first (Story 5.1). Public — the first unauthenticated `GET` route in this codebase. Feeds the pickup-slot picker at checkout (`/cart`); distinct from the vendor-scoped `GET /api/pickup-slots` below, which requires a signed-in vendor session and returns all of that vendor's slots (past and future) for dashboard management.

**Request body:** none.

**Auth:** none.

**Behavior:**
1. `prisma.pickupSlot.findMany({ where: { vendorId: params.vendorId, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } })` — only upcoming slots.
2. No vendor-existence check — an unknown `vendorId` returns the same empty-array shape as a real vendor with zero upcoming slots. `POST /api/checkout` re-validates the selected slot's vendor ownership regardless of what this route returns, so this isn't a new trust boundary.
3. Each slot's `available` is computed server-side: `prisma.order.groupBy({ by: ["pickupSlotId"], where: { pickupSlotId: { in: <slot ids> }, status: { in: ["PENDING", "PAID"] } }, _count: { _all: true } })`, then `bookedCount < capacity`. `PENDING` counts alongside `PAID` — same reasoning as `POST /api/checkout`'s capacity check above. Advisory only — `/cart`'s picker uses it to disable/badge a full slot as "Full" (not required by the AC, matches FR7's out-of-stock precedent: shown, not hidden), but the actual enforcement is `POST /api/checkout`'s own re-check at order-creation time.
4. Also looks up `Vendor.timezone` (Story 6.1, FR17) — `/cart` needs it to display each slot's window in the vendor's own configured timezone, matching the storefront/dashboard. Falls back to `"UTC"` for an unknown `vendorId`; never actually rendered in that case, since `slots` is also empty.

**Response:** `200 { slots: Array<{ id: string; startsAt: string; endsAt: string; location: string | null; available: boolean }>; timezone: string }`, even for zero slots (not a `404` — "no pickup times available" is a valid, expected state).

---

### `GET /api/products`
Lists the signed-in vendor's products.

- Auth: vendor-scoped (401 if no current vendor).
- Response: `200 { products: Product[] }`, ordered `createdAt desc`. Not filtered by stock — this is the vendor's own management view, unlike the storefront query, and vendors need to see out-of-stock products to restock them.

### `POST /api/products`
Creates a product for the signed-in vendor.

**Request body** (`CreateProductSchema`):
```ts
{
  name: string,            // min length 1
  description?: string,
  priceCents: number,      // positive int
  imageUrl?: string,       // must be a Cloudinary URL (https://res.cloudinary.com/...)
}
```
- 401 if unauthenticated; 400 `{ error: "Invalid request" }` on schema mismatch.
- Response: `201 { product: Product }`.

---

### `POST /api/products/upload-image`
Uploads a vendor-supplied product image to Cloudinary (Story 4.1). `AddProductForm` calls this first, then includes the returned `imageUrl` in the `POST /api/products` payload above — two sequential requests, not a combined one (see that story's Dev Notes for why).

**Request body** (`UploadImageSchema`):
```ts
{
  image: string,   // base64 data URL, e.g. "data:image/png;base64,...", max ~4,000,000 chars (~3MB raw file)
}
```

**Auth:** vendor-scoped — `getCurrentVendor()` (`401` if none) then `assertVendorActive()` (`403` if deactivated), same shape as `POST /api/products`.

**Behavior:**
1. `req.json().catch(() => null)` then `safeParse` → `400 { error: <schema message> }` on failure — distinct messages for "not a base64 image" vs. "too large" (the schema's own `.refine()` message is passed through, not a generic "Invalid request", so the form can show the vendor what actually went wrong).
2. Calls `uploadImage(image)` (`src/lib/cloudinary.ts`) — a full server-side upload; the browser never sees Cloudinary credentials. A Cloudinary-side failure (network, quota, invalid image data) is caught and mapped to `502 { error: "Could not upload image. Try again." }`, `Sentry.captureException`'d, never an unhandled `500`.

**Response:** `200 { imageUrl: string }` — the Cloudinary `secure_url`, always starting with `https://res.cloudinary.com/`.

---

### `DELETE /api/products/upload-image`
Deletes a Cloudinary asset by its `secure_url` — compensating cleanup when `POST /api/products` fails *after* `POST /api/products/upload-image` already succeeded, so the upload doesn't sit orphaned in Cloudinary storage forever (Story 4.1, review-deferred item, resolved 2026-08-26). `AddProductForm` fires this best-effort (fire-and-forget) on a failed product-creation response when an image had already been uploaded.

**Request body** (`DeleteImageSchema`):
```ts
{
  imageUrl: string,   // a Cloudinary secure_url, e.g. "https://res.cloudinary.com/.../local-food/abc123.jpg"
}
```

**Auth:** vendor-scoped — same `getCurrentVendor()`/`assertVendorActive()` shape as the other routes in this file.

**Behavior:**
1. `400 { error: "Invalid request" }` if the body doesn't parse.
2. **Safety check, not an ownership check:** this endpoint has no record of which vendor uploaded which image before a `Product` row exists to attach it to — refuses (`400 { error: "Image is in use" }`) if any `Product.imageUrl` still references the URL, so it can only ever delete a genuine orphan, never a live product's image (regardless of which vendor is asking).
3. Calls `deleteImage(imageUrl)` (`src/lib/cloudinary.ts`), which derives the Cloudinary `public_id` from the URL itself (no separate storage needed) and calls `cloudinary.uploader.destroy()`. A Cloudinary-side failure is caught, `Sentry.captureException`'d, and swallowed — this is best-effort cleanup, not something that should block the caller's own (already-failing) request.

**Response:** `200 {}` on success (including the swallowed-failure case above).

---

### `POST /api/admin/vendors`
Admin-only vendor onboarding (Story 2.2). Creates a `Vendor` unbound from any Clerk user.

**Request body** (`CreateVendorSchema`):
```ts
{
  name: string,          // trimmed, min length 1 after trimming
  slug: string,          // trimmed, min length 1 after trimming — format/normalization/uniqueness resolved server-side, not by this schema
  phone?: string,
  description?: string,
}
```

**Auth:** `getCurrentAdmin()` — `401 { error: "Unauthorized" }` if no current admin. **Not covered by `middleware.ts`'s matcher** (`/admin(.*)` matches page routes under `/admin/*`, not this route's `/api/admin/vendors` path) — this self-check is the sole gate, same as every other API route in this codebase.

**Behavior:**
1. `req.json().catch(() => null)` then `safeParse` → `400 { error: "Invalid request" }` on failure. `name`/`slug` are trimmed and must be non-empty after trimming.
2. `resolveVendorSlug(slug)` (`src/lib/vendor.ts`, AD-7) normalizes the slug via `slugify()` — **the stored/returned `slug` can differ from what was submitted** (e.g. `"Corner Bakery"` → `"corner-bakery"`), and a submission that normalizes to an empty string (all-punctuation/whitespace input) is rejected rather than creating an unreachable vendor. Then checks the normalized slug against existing `Vendor.slug` values — a collision → `409 { error: "The slug \"...\" is already in use — try a different one." }`.
3. Creates the `Vendor` with `clerkUserId: null` (unbound until claimed, AD-8 — binding happens manually, out-of-band, later) and `createdByAdminId` set to the acting admin's `Admin.id` (AD-5 — attribution targets the row id, not `clerkUserId`). The create is wrapped in its own `try/catch`: a same-slug race between two concurrent requests (both pass step 2's check before either creates) is caught as a Prisma `P2002` and mapped to the identical friendly `409` — a raw Prisma unique-constraint failure should never reach the client either way. Any other DB failure → `500`, `Sentry.captureException`.

**Response:** `201 { vendor: Vendor }` — the full row, including internal fields (`createdByAdminId`, timestamps). Fine today since this route is admin-only; reconsider before ever exposing an equivalent read endpoint outside `/admin/*`. The new vendor's storefront is live at `/vendors/{slug}` immediately — no separate publish step.

---

### `POST /api/admin/vendors/[id]/deactivate`
Admin-only vendor deactivation (Story 2.3). Soft-deletes a `Vendor` — never a hard delete.

**Request body:** none.

**Auth:** `getCurrentAdmin()` — `401 { error: "Unauthorized" }` if no current admin. Not covered by `middleware.ts`'s matcher, same reasoning as `POST /api/admin/vendors`.

**Behavior:**
1. **Atomic claim, not check-then-act**: `prisma.vendor.updateMany({ where: { id: params.id, deletedAt: null }, data: { deletedAt: <now>, deletedByAdminId: <acting admin's Admin.id> } })` (AD-5 — targets the row id, not `clerkUserId`). The `deletedAt: null` guard in the `WHERE` clause means only a genuinely still-active row can be claimed — two concurrent requests can't both "win" and reassign attribution, matching `POST /api/webhooks/stripe`'s `stockDecremented` claim pattern.
2. `prisma.vendor.findUnique({ where: { id: params.id } })` re-read — `404 { error: "Not found" }` if the vendor doesn't exist. No ownership scoping (an admin route legitimately operates across all vendors).
3. **Idempotent**: if the vendor was already deactivated before this call, step 1's `updateMany` matches 0 rows and no-ops — the re-read in step 2 returns the row unchanged, still attributed to whoever deactivated it first.
4. No un-deactivate/reactivate endpoint exists.

**Response:** `200 { vendor: Vendor }` — the current (possibly just-updated) row.

**Downstream effects** (`assertVendorActive()`, `src/lib/vendor.ts`, AD-4 — throws `VendorDeactivatedError`, never returns a boolean):
- The vendor's storefront (`GET /vendors/{slug}`) stays reachable (`200`, name still shown) but replaces the listing/pickup-slot banner with a "no longer available" message — not a `404`.
- `POST /api/checkout` rejects any new order for the vendor's products: `400 { error: "This vendor is no longer accepting orders" }`.
- Existing orders in any non-terminal status continue their normal fulfillment lifecycle unchanged (pickup, SMS, status updates) — the vendor's own `/dashboard/*` access is completely untouched by deactivation.

---

### `GET /api/pickup-slots`
Lists the signed-in vendor's pickup slots, ordered `startsAt asc`.

- Auth: vendor-scoped.
- Response: `200 { slots: PickupSlot[] }`.

### `POST /api/pickup-slots`
Creates a pickup slot for the signed-in vendor.

**Request body** (`CreateSlotSchema`):
```ts
{
  startsAt: string,   // ISO 8601 datetime, any valid UTC offset accepted (not just "Z"); refined: must be after the current server time (Story 5.2, FR16)
  endsAt: string,      // ISO 8601 datetime, any valid UTC offset accepted (not just "Z"); refined: must be after startsAt
  capacity?: number,   // positive int, default 20
  location?: string,
}
```
- The wire format is unchanged by Story 6.1 (FR17) — still an absolute ISO instant, both refines still compare absolute instants server-side. What changed is *how the dashboard client computes that instant*: `AddSlotForm.tsx` now interprets its `datetime-local` inputs' wall-clock digits as being in the signed-in vendor's own `Vendor.timezone`, not the submitting browser's local timezone, before converting to ISO. A direct API caller bypassing the dashboard is unaffected — it always sent (and must still send) an absolute instant, never bare wall-clock digits.
- 401 if unauthenticated; 400 on schema/refinement failure.
- Response: `201 { slot: PickupSlot }`.
- Called by the dashboard's "Add slot" button (`AddSlotForm.tsx`).

---

### `POST /api/webhooks/stripe`
Stripe → app event delivery. Confirms payment, decrements stock, alerts the admin on a low-stock crossing or a shortfall, and triggers the customer SMS.

**Critical implementation detail:** reads `req.text()` (raw body), never `req.json()`. Stripe's signature verification (`stripe.webhooks.constructEvent`) needs the exact raw bytes; parsing JSON first breaks the signature check silently (wrong-error, not obviously "you parsed the body").

**Events handled:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`. All other event types are acked (`200`) and ignored.

**Behavior:**
1. Missing `stripe-signature` header or unset `STRIPE_WEBHOOK_SECRET` → `400`.
2. Signature mismatch (`constructEvent` throws) → `400 { error: <message> }`.
3. **`checkout.session.completed` only proceeds if `session.payment_status === "paid"`.** This event fires immediately for every session, including delayed-notification payment methods (e.g. bank transfers) that haven't actually captured money yet — those complete with `payment_status: "unpaid"`, and this route waits for `async_payment_succeeded` instead of marking the order paid prematurely. `async_payment_succeeded` runs the exact same success path described below (steps 4-6); it's the same handler function, just triggered by a different event.
4. **Session cross-check, before trusting `session.metadata.orderId` for anything:** if `Order.stripeSessionId` is set and doesn't match the incoming `session.id`, the event is ignored — logged via `console.error`, still `200`. Only activates when `stripeSessionId` is set (every real checkout-created order has it).
5. `prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID" } })`. Guarding on `status: "PENDING"` specifically (not `status: { not: "PAID" }`) matters: an order that has since moved to `READY`/`COMPLETED`/`CANCELLED` must never be pulled back to `PAID` by a late replay (Stripe retries for up to 3 days) — only a genuinely `PENDING` order transitions.
6. **Customer confirmation SMS, sent before the stock-decrement/admin-alert block below (Story 3.2 — moved here specifically so admin bookkeeping can never delay or block it).** If `order.smsNotified === false`: sends the pickup-confirmation SMS via Twilio, then sets `smsNotified: true`. Also gated on `order.status === "PAID"` — a CANCELLED order never gets the "order confirmed" message. This flag is the **only** replay/idempotency guard for the SMS specifically — stock decrement has its own guard via `stockDecremented` (step 7a). Unlike the stock guard, this is a plain read-then-act check, not an atomic claim — two genuinely concurrent deliveries of the same event can both pass it and both text the customer. Independent of `stockDecremented` — this runs on every call where the order is `PAID` and not yet notified, including a retry where a *previous* call already decremented stock.
7. Loads the order's `items` regardless of whether this call made the transition (a retry after a transient failure needs to see them too — see step 7a). If any line finds insufficient stock (a post-payment race — money already captured, stock ran out before this webhook ran), the whole transaction rolls back, every short line (not just the first) is reported via `Sentry.captureException` + `console.error` with the order id and each short product's requested/available quantities, and the order still ends up `PAID` — there's nothing to "reject" once Stripe has already charged the customer. This is not auto-resolved or auto-refunded; it's surfaced for manual admin follow-up (Story 3.2).
   7a. **Decrementing is guarded by `order.stockDecremented` (a separate flag from `status`), not by whether this call made the `PENDING → PAID` transition.** If `order.status === "PAID"` and `stockDecremented` is still `false`, this call attempts the decrement — whether it just flipped the status itself, or a *previous* call flipped it and then failed before finishing (a deadlock, a dropped pooled connection, a killed serverless invocation). The flag is **claimed atomically as the first write inside the `prisma.$transaction()`** (`updateMany({ where: { id, stockDecremented: false }, data: { stockDecremented: true } })`) — not read-then-acted-on separately — so two *concurrent* deliveries of the same event can't both pass the guard: the second blocks on the `Order` row and sees `count === 0` once the first commits. A failed attempt (the whole transaction rolls back, claim included) leaves the flag `false`, so Stripe's retry re-attempts cleanly instead of finding `status` already `PAID` and silently giving up. **A stock shortfall is terminal**, not a retry signal: the claim is deliberately *not* rolled back on a shortfall (only the specific decrements are undone), so a later replay or manual Stripe "Resend" never silently re-decrements once stock happens to be replenished. Line items are sorted by `productId` before decrementing so two orders sharing products always acquire Postgres row locks in the same relative order, regardless of each order's own line order — this is what prevents a deadlock between two concurrent multi-item orders that list the same products in opposite order. The transaction also sets a Postgres `lock_timeout` of 15s as its first statement, bounding how long it can block *waiting* to acquire a row lock (Prisma's own `timeout` option only bounds the transaction once a query completes, not while one is blocked). Inside the transaction, `decrementStock()` also reports whether the decrement newly crossed the product's `lowStockThreshold` (`crossedLowStock`) — collected per line into a list, consumed by step 7b below.
   7b. **Story 3.2 — admin alerts, sent after the transaction commits (never inside it — an SMS is an external network call and must not run while holding DB row locks).** Two independent, differently-gated cases:
       - **Shortfall:** for each shortfalled line — aggregated by `productId` first, so a product appearing on two `OrderItem` lines of the same order gets exactly one text, not one per line — a shortfall SMS is sent to every admin phone from `getAdminPhoneNumbers()` (`src/lib/admin.ts`, every `Admin` row with a non-blank phone, deduplicated). **Never gated by `lowStockAlerted`** — a shortfall means a customer's payment was already captured and the order couldn't be fully fulfilled, a different and more urgent event class than the routine low-stock crossing; each occurrence is surfaced every time, not deduped. `available` in the message is the stock read at the moment of failure, or a literal "unknown (product deleted)" if the product row no longer exists — never coerced to `0`, which would misreport a deleted product as merely out of stock.
       - **Low-stock crossing:** for each product whose decrement newly crossed `lowStockThreshold` (`crossedLowStock: true`, meaning `lowStockAlerted` was `false` beforehand — "newly crossed," not just "currently low") — **and which was not later rolled back by a shortfall on a different line of the same order** (the crossing list returned from the transaction is empty whenever the order shortfalls at all, since the compensation loop undoes every applied decrement, this one included) — `lowStockAlerted` is claimed atomically first (`updateMany({ where: { id, lowStockAlerted: false } })`), *then* a low-stock SMS is sent to every admin phone. If nothing sends successfully, the claim is reverted back to `false` so a later crossing can retry — the flag is never left `true` without an actual successful send (AC #3/#4). The atomic claim (rather than a plain check-then-write) matters because the outer `stockDecremented` claim (step 7a) only guarantees one concurrent delivery *of a given order's event*, not one concurrent crossing *of a given product* — two different orders can legitimately race to decrement the same product's last few units, each independently seeing the pre-crossing state.
       - Zero admins with a phone configured → no SMS attempted; `lowStockAlerted` claims automatically revert (nothing sent), and no shortfall report is logged as a delivery failure since none was attempted.
8. **`checkout.session.async_payment_failed`:** a delayed-notification payment method's payment definitively failed. Same session cross-check as step 4, then `prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } })` — only a still-PENDING order transitions. Never marks paid, never decrements stock (nothing to reverse, since a decrement never happened on this path).
9. Always returns `200 { received: true }` for anything past signature verification (including unhandled event types, a missing/stale `orderId`, a session.id mismatch, an unpaid `checkout.session.completed`, or a stock shortfall), per Stripe's recommendation to ack receipt. A *shortfall* never fails the webhook. A non-shortfall failure during the decrement (e.g. a deadlock) is allowed to surface as a 5xx and let Stripe retry, specifically so step 7a's guard gets a chance to re-attempt.

**Idempotency:** `status` itself will never move backward from `READY`/`COMPLETED`/`CANCELLED`. Stock decrement (via `stockDecremented`, step 7a) is safe even under *concurrent* redelivery of the same event — the flag is claimed atomically inside the transaction, and a shortfall is terminal rather than retryable. The SMS (via `smsNotified`) is only safe against *sequential* replay — it's a plain read-then-act check, so two genuinely concurrent deliveries can both pass it and both text the customer. `lowStockAlerted` (step 7b) is safe under concurrent redelivery *and* under two different orders racing to decrement the same product, since it's claimed atomically before the send, not after. There's still no dedup on the Stripe event ID itself.
