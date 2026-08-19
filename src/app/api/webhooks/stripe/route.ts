/**
 * POST /api/webhooks/stripe
 *
 * Stripe calls this URL after events happen (here: a completed checkout).
 * We must:
 *   1. Verify the signature so we know the request really came from Stripe.
 *   2. On checkout.session.completed, mark the matching order PAID — only
 *      a genuinely PENDING order transitions; a replay or an order that has
 *      since moved to READY/COMPLETED/CANCELLED is never touched.
 *   3. Decrement stock for each line item (Story 1.4), guarded by its own
 *      `stockDecremented` flag (not `status`) so a retry after a transient
 *      failure between the PAID commit and the decrement re-attempts
 *      cleanly instead of losing the decrement permanently.
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

// Sentinel thrown inside the $transaction callback to trigger Prisma's
// automatic full rollback when any line's stock is insufficient (AC #2).
// Never surfaced to the caller as a thrown error - caught and reported via
// Sentry instead (AC #5); the webhook still returns 200. Carries every short
// line (not just the first) plus each one's current stock, so the report is
// actionable rather than a bare message naming one product (review round 1).
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
      // was CANCELLED, is never touched by a later/replayed webhook.
      const transition = await prisma.order.updateMany({
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

      // `stockDecremented` (not `transition.count`) is the retry-safe guard
      // for whether decrementing still needs to happen. If this call made
      // the PENDING -> PAID transition, it's obviously still false. But a
      // *previous* call may have made that transition and then failed
      // between committing PAID and finishing the decrement (a deadlock, a
      // dropped pooled connection, a killed serverless invocation) - with
      // the old code, that failure permanently burned the one-shot
      // `status`-based guard and silently lost the decrement forever
      // (review round 1, reproduced live via a forced lock timeout). Guarding
      // on a flag set inside the *same* $transaction as the decrements means
      // a failed attempt leaves it false, so Stripe's retry re-attempts
      // cleanly instead of finding status already PAID and giving up.
      if (order.status === "PAID" && !order.stockDecremented) {
        try {
          await prisma.$transaction(async (tx) => {
            // Stable lock-acquisition order across concurrent transactions
            // touching overlapping products. Two orders listing the same
            // products in opposite line order previously deadlocked
            // reliably (review round 1, reproduced 5/6 runs) - checkout
            // preserves raw cart line order, so two shoppers adding the
            // same two products in different order hit this directly.
            const items = [...order.items].sort((a, b) =>
              a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
            );

            // Collect every short line rather than throwing on the first,
            // so the eventual report names all of them, not just one
            // (review round 1).
            const shortfalls: Array<{ productId: string; requested: number }> =
              [];
            for (const item of items) {
              const decremented = await decrementStock(
                tx,
                item.productId,
                item.quantity,
              );
              if (!decremented) {
                shortfalls.push({
                  productId: item.productId,
                  requested: item.quantity,
                });
              }
            }

            if (shortfalls.length > 0) {
              const currentStock = await tx.product.findMany({
                where: { id: { in: shortfalls.map((s) => s.productId) } },
                select: { id: true, stockQuantity: true },
              });
              throw new StockShortfallError(
                order.id,
                shortfalls.map((s) => ({
                  ...s,
                  available:
                    currentStock.find((p) => p.id === s.productId)
                      ?.stockQuantity ?? null,
                })),
              );
            }

            await tx.order.update({
              where: { id: order.id },
              data: { stockDecremented: true },
            });
          });
        } catch (err) {
          if (err instanceof StockShortfallError) {
            // Payment already happened - there's nothing to "reject" at
            // this point. Surface it rather than silently swallow or
            // auto-refund (AC #5); a human resolves it (Story 3.2).
            // Sentry.captureException is currently a no-op in this app
            // (missing instrumentation.ts, pre-existing gap - review round
            // 1) - console.error alongside it so the event at least lands
            // in server/Vercel logs until that's fixed.
            Sentry.captureException(err, {
              extra: { orderId: err.orderId, shortfalls: err.shortfalls },
            });
            console.error(
              "[webhooks/stripe] stock shortfall",
              err.orderId,
              err.shortfalls,
            );
          } else {
            // Not a shortfall - a transient failure (deadlock, dropped
            // connection, etc). Rethrow so Stripe sees a 5xx and retries;
            // `stockDecremented` is still false, so the retry cleanly
            // re-attempts the decrement above.
            throw err;
          }
        }
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
