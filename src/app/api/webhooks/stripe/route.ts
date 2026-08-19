/**
 * POST /api/webhooks/stripe
 *
 * Stripe calls this URL after events happen (here: a completed checkout).
 * We must:
 *   1. Verify the signature so we know the request really came from Stripe.
 *   2. On checkout.session.completed, mark the matching order PAID — only
 *      a genuinely PENDING order transitions; a replay or an order that has
 *      since moved to READY/COMPLETED/CANCELLED is never touched.
 *   3. Decrement stock for each line item (Story 1.4). Guarded by an
 *      `Order.stockDecremented` flag claimed atomically as the first write
 *      inside the same transaction as the decrements - not by `status`,
 *      and not by a plain read-then-act check on the flag - so a retry
 *      after a transient failure re-attempts cleanly, two concurrent
 *      deliveries of the same event can't both decrement, and a genuine
 *      stock shortfall is terminal (never silently re-attempted once
 *      stock happens to be replenished).
 *   4. Text the customer via Twilio.
 *
 * IMPORTANT: this route reads the RAW request body for signature verification,
 * so we do not parse it as JSON first.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendSms, orderConfirmedMessage } from "@/lib/sms";
import { decrementStock } from "@/lib/inventory";

// Carries every short line (not just the first) plus each one's current
// stock, so the eventual report is actionable rather than a bare message
// naming one product (review round 1). Purely a data/message carrier now -
// no longer thrown as control flow (review round 2, see the transaction
// below for why).
class StockShortfallError extends Error {
  constructor(
    public readonly orderId: string,
    public readonly shortfalls: Array<{
      productId: string;
      requested: number;
      available: number | null; // null = product row no longer exists
    }>,
  ) {
    super(
      `Stock shortfall on order ${orderId}: ${shortfalls
        .map(
          (s) =>
            `${s.productId} (requested ${s.requested}, available ${
              s.available === null ? "none - product deleted" : s.available
            })`,
        )
        .join("; ")}`,
    );
  }
}

type ShortfallDetail = {
  productId: string;
  requested: number;
  available: number | null;
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text(); // raw body, not JSON
  const signature = req.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    // Bad signature — reject.
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      // Only a genuinely PENDING order can become PAID here. Guarding on
      // `status: "PENDING"` (not `status: { not: "PAID" }`) matters: the
      // old guard also matched READY/COMPLETED/CANCELLED, so a Stripe
      // retry arriving after a vendor marked an order READY/COMPLETED
      // silently reverted it back to PAID and re-decremented stock (review
      // round 1, reproduced live). An order that has moved past PAID, or
      // was CANCELLED, is never touched by a later/replayed webhook. The
      // result isn't read - `stockDecremented` below is the real
      // decrement-guard signal, not whether this call made the transition
      // (review round 2, P0: this used to be captured as unused `transition`).
      await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID" },
      });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, vendor: true },
      });

      // Bad/stale orderId - nothing to do. Returning the normal 200 here
      // (instead of the old bare .update()'s uncaught P2025-turned-500) is
      // an incidental fix from restructuring to updateMany + findUnique,
      // not new scope.
      if (!order) {
        return NextResponse.json({ received: true });
      }

      // `stockDecremented` is the retry-safe guard for whether decrementing
      // still needs to happen - not whether *this* call made the PENDING ->
      // PAID transition. But a plain read-then-act check here (read the
      // flag, then separately decide to enter the transaction) is itself
      // racy: two concurrent deliveries of the *same* event can both read
      // `false` before either commits, and both decrement (review round 2,
      // D1, reproduced live 8/9 rounds). The flag must be claimed
      // atomically as the transaction's first write, so a second concurrent
      // caller's claim blocks on the Order row and then sees `count === 0`
      // once the first commits.
      if (order.status === "PAID" && !order.stockDecremented) {
        const result = await prisma.$transaction(async (tx) => {
          const claim = await tx.order.updateMany({
            where: { id: order.id, stockDecremented: false },
            data: { stockDecremented: true },
          });
          if (claim.count === 0) {
            // Lost the race to another concurrent delivery of this same
            // event (or someone else already handled it) - nothing left
            // to do.
            return { shortfalls: [] as ShortfallDetail[] };
          }

          // Stable lock-acquisition order across concurrent transactions
          // touching overlapping products. Two orders listing the same
          // products in opposite line order previously deadlocked
          // reliably (review round 1, reproduced 5/6 runs) - checkout
          // preserves raw cart line order, so two shoppers adding the
          // same two products in different order hit this directly.
          const items = [...order.items].sort((a, b) =>
            a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
          );

          // Collect every short line rather than stopping at the first,
          // so the eventual report names all of them, not just one
          // (review round 1). Track what was actually applied so a
          // shortfall can be undone without rolling back the claim above
          // (see below).
          const applied: Array<{ productId: string; quantity: number }> = [];
          const shortfalls: Array<{ productId: string; requested: number }> =
            [];
          for (const item of items) {
            const decremented = await decrementStock(
              tx,
              item.productId,
              item.quantity,
            );
            if (decremented) {
              applied.push({ productId: item.productId, quantity: item.quantity });
            } else {
              shortfalls.push({
                productId: item.productId,
                requested: item.quantity,
              });
            }
          }

          if (shortfalls.length === 0) {
            return { shortfalls: [] as ShortfallDetail[] };
          }

          // A shortfall is terminal (AC #5, and documented in
          // api-contracts.md / deferred-work.md) - a later replay or
          // manual Stripe "Resend" must not silently re-attempt and
          // decrement again once stock happens to be replenished (review
          // round 2, D2). That means the claim above must survive a
          // shortfall, which rules out throwing to trigger Prisma's
          // automatic rollback (that would undo the claim too). Instead:
          // undo only the lines this pass actually applied - AC #2's
          // all-or-nothing still holds (no line ends up partially
          // decremented) - and let the transaction commit normally with
          // the claim intact.
          for (const item of applied) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }

          const currentStock = await tx.product.findMany({
            where: { id: { in: shortfalls.map((s) => s.productId) } },
            select: { id: true, stockQuantity: true },
          });
          return {
            shortfalls: shortfalls.map((s) => ({
              ...s,
              available:
                currentStock.find((p) => p.id === s.productId)
                  ?.stockQuantity ?? null,
            })),
          };
        });

        if (result.shortfalls.length > 0) {
          // Payment already happened - there's nothing to "reject" at
          // this point. Surface it rather than silently swallow or
          // auto-refund (AC #5); a human resolves it (Story 3.2).
          // Sentry.captureException is currently a no-op in this app
          // (missing instrumentation.ts, pre-existing gap - review round
          // 1) - console.error alongside it so the event at least lands
          // in server/Vercel logs until that's fixed.
          const err = new StockShortfallError(order.id, result.shortfalls);
          Sentry.captureException(err, {
            extra: { orderId: err.orderId, shortfalls: err.shortfalls },
          });
          console.error(
            "[webhooks/stripe] stock shortfall",
            err.orderId,
            err.shortfalls,
          );
        }
        // A genuine transient failure (deadlock, dropped connection, etc)
        // during any of the above throws a real error out of $transaction,
        // which is not caught here - it propagates to a 5xx, Stripe
        // retries, and since nothing in that failed attempt committed
        // (including the claim), the retry re-attempts cleanly.
      }

      // Notify the customer once. Only record it as notified if the SMS
      // actually sent — a Twilio failure must not mark this done, or the
      // customer never gets retried.
      if (!order.smsNotified) {
        const sent = await sendSms(
          order.customerPhone,
          orderConfirmedMessage(order.vendor.name, order.id),
        );
        if (sent) {
          await prisma.order.update({
            where: { id: order.id },
            data: { smsNotified: true },
          });
        }
      }
    }
  }

  // Always 200 so Stripe knows we received the event.
  return NextResponse.json({ received: true });
}
