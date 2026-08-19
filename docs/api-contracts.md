# API Contracts

All routes live under `src/app/api/` (Next.js App Router route handlers). None use a shared response envelope — each returns `{ ...data }` or `{ error: string }` directly via `NextResponse.json`.

## Auth model

- **Vendor-scoped routes** (`products`, `pickup-slots`) call `getCurrentVendor()` (`src/lib/vendor.ts`), which reads the Clerk session and looks up the `Vendor` row by `clerkUserId`. No vendor row → `401 Unauthorized`. There is no separate authorization check beyond "does a Vendor row exist for this Clerk user" — a signed-in vendor can only ever see/write their own data because every query filters `where: { vendorId: vendor.id }`.
- **Public routes** (`checkout`) take no auth — anyone can place an order against any `vendorId`, which is the intended storefront behavior.
- **Webhook route** (`webhooks/stripe`) authenticates the *caller* (Stripe) via HMAC signature (`stripe-signature` header + `STRIPE_WEBHOOK_SECRET`), not via Clerk.
- `middleware.ts` additionally hard-blocks unauthenticated access to `/dashboard(.*)` at the edge, before any page/route code runs.

---

### `POST /api/checkout`
Creates a `PENDING` order and a Stripe Checkout session.

**Request body** (validated by `CheckoutSchema`, Zod):
```ts
{
  vendorId: string,       // min length 1
  customerName: string,   // min length 1
  customerPhone: string,  // min length 5
  items: Array<{ productId: string; quantity: number /* positive int */ }>  // min 1 item
}
```

**Behavior:**
1. `req.json().catch(() => null)` then `safeParse` — malformed JSON or schema mismatch → `400 { error: "Invalid request" }`.
2. Quantities are aggregated per `productId` first (a cart can list the same product on multiple lines), then the distinct products are re-fetched from the DB, filtered by `vendorId`. If the count doesn't match the number of distinct requested products (one is deleted or belongs to a different vendor), → `400 { error: "One or more items are unavailable" }`.
3. Stock sufficiency check: `stockQuantity >= totalRequestedQuantity` per product (architecture AD-2 — availability is computed from `stockQuantity`, not a stored boolean; totaled across duplicate lines for the same product). Any short product rejects the whole order → `400 { error: "One or more items don't have enough stock" }`, before anything is created. **This check is a point-in-time read with no reservation or transaction** — it does not itself prevent two concurrent checkouts from both passing for the same last unit. Stock itself is never written here; the actual decrement happens later, in `POST /api/webhooks/stripe`, only once Stripe confirms payment (Story 1.4) — see that route's contract below.
4. Computes `totalCents` from DB prices — the client-sent price (there is none in this schema) can never influence the charge.
5. Creates `Order` (status `PENDING`) with nested `OrderItem` creates.
6. Creates a Stripe Checkout session (`mode: "payment"`), `metadata: { orderId }` so the webhook can find it back, `success_url` → `/checkout/success`, `cancel_url` → `/cart`.
7. Updates the `Order` with `stripeSessionId`.

**Response:** `200 { url: string }` — the Stripe-hosted checkout URL to redirect the browser to.

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
  imageUrl?: string,       // must be a valid URL
}
```
- 401 if unauthenticated; 400 `{ error: "Invalid request" }` on schema mismatch.
- Response: `201 { product: Product }`.
- **Not currently called by any UI** — the dashboard "Add product" button has no handler yet.

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
  startsAt: string,   // ISO datetime
  endsAt: string,      // ISO datetime, refined: must be after startsAt
  capacity?: number,   // positive int, default 20
  location?: string,
}
```
- 401 if unauthenticated; 400 on schema/refinement failure.
- Response: `201 { slot: PickupSlot }`.
- **Not currently called by any UI** — the dashboard "Add slot" button has no handler yet.

---

### `POST /api/webhooks/stripe`
Stripe → app event delivery. Confirms payment, decrements stock, and triggers the SMS.

**Critical implementation detail:** reads `req.text()` (raw body), never `req.json()`. Stripe's signature verification (`stripe.webhooks.constructEvent`) needs the exact raw bytes; parsing JSON first breaks the signature check silently (wrong-error, not obviously "you parsed the body").

**Behavior:**
1. Missing `stripe-signature` header or unset `STRIPE_WEBHOOK_SECRET` → `400`.
2. Signature mismatch (`constructEvent` throws) → `400 { error: <message> }`.
3. On `checkout.session.completed`: reads `session.metadata.orderId`, then `prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID" } })`. Guarding on `status: "PENDING"` specifically (not `status: { not: "PAID" }`) matters: an order that has since moved to `READY`/`COMPLETED`/`CANCELLED` must never be pulled back to `PAID` by a late replay (Stripe retries for up to 3 days) — only a genuinely `PENDING` order transitions.
4. Loads the order's `items` regardless of whether this call made the transition (a retry after a transient failure needs to see them too — see step 4a). If any line finds insufficient stock (a post-payment race — money already captured, stock ran out before this webhook ran), the whole transaction rolls back, every short line (not just the first) is reported via `Sentry.captureException` + `console.error` with the order id and each short product's requested/available quantities, and the order still ends up `PAID` — there's nothing to "reject" once Stripe has already charged the customer. This is not auto-resolved or auto-refunded; it's surfaced for manual admin follow-up (Story 3.2, once an Admin identity exists).
   4a. **Decrementing is guarded by `order.stockDecremented` (a separate flag from `status`), not by whether this call made the `PENDING → PAID` transition.** If `order.status === "PAID"` and `stockDecremented` is still `false`, this call attempts the decrement — whether it just flipped the status itself, or a *previous* call flipped it and then failed before finishing (a deadlock, a dropped pooled connection, a killed serverless invocation). `stockDecremented` is set `true` inside the *same* `prisma.$transaction()` as the decrements, so a failed attempt leaves it `false` and Stripe's retry re-attempts cleanly instead of finding `status` already `PAID` and silently giving up. Line items are sorted by `productId` before decrementing so two orders sharing products always acquire Postgres row locks in the same relative order, regardless of each order's own line order — this is what prevents a deadlock between two concurrent multi-item orders that list the same products in opposite order.
5. If `order.smsNotified === false`: sends the pickup-confirmation SMS via Twilio, then sets `smsNotified: true`. This flag is the **only** replay/idempotency guard for the SMS specifically — stock decrement has its own guard via `stockDecremented` (step 4a).
6. Always returns `200 { received: true }` for anything past signature verification (including unhandled event types, a missing/stale `orderId`, or a stock shortfall), per Stripe's recommendation to ack receipt. A *shortfall* never fails the webhook. A non-shortfall failure during the decrement (e.g. a deadlock) is allowed to surface as a 5xx and let Stripe retry, specifically so step 4a's guard gets a chance to re-attempt.

**Idempotency:** the SMS (via `smsNotified`) and stock decrement (via `stockDecremented`, step 4a) are independently replay-safe if Stripe redelivers the same `checkout.session.completed` event, and `status` itself will never move backward from `READY`/`COMPLETED`/`CANCELLED`. There's still no dedup on the Stripe event ID itself, but none of these three side effects can double-fire as a result.
