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
2. Re-fetches the named products from the DB, filtered by `vendorId`. If the count returned doesn't match `items.length` (an item is deleted or belongs to a different vendor), → `400 { error: "One or more items are unavailable" }`.
3. Per-line stock sufficiency check: `stockQuantity >= quantity` for every line (architecture AD-2 — availability is computed from `stockQuantity`, not a stored boolean). Any short line rejects the whole order → `400 { error: "One or more items don't have enough stock" }`, before anything is created.
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
Stripe → app event delivery. Confirms payment and triggers the SMS.

**Critical implementation detail:** reads `req.text()` (raw body), never `req.json()`. Stripe's signature verification (`stripe.webhooks.constructEvent`) needs the exact raw bytes; parsing JSON first breaks the signature check silently (wrong-error, not obviously "you parsed the body").

**Behavior:**
1. Missing `stripe-signature` header or unset `STRIPE_WEBHOOK_SECRET` → `400`.
2. Signature mismatch (`constructEvent` throws) → `400 { error: <message> }`.
3. On `checkout.session.completed`: reads `session.metadata.orderId`, updates that `Order` to `status: PAID`.
4. If `order.smsNotified === false`: sends the pickup-confirmation SMS via Twilio, then sets `smsNotified: true`. This flag is the **only** replay/idempotency guard — any new code path that can reach "mark PAID" must check/set it the same way, or customers get double-texted.
5. Always returns `200 { received: true }` for anything past signature verification (including unhandled event types), per Stripe's recommendation to ack receipt.

**Not idempotency-guarded beyond `smsNotified`**: if Stripe redelivers the same `checkout.session.completed` event, the `Order.update` to `PAID` re-runs (harmless, same value) but there's no dedup on the event ID itself.
