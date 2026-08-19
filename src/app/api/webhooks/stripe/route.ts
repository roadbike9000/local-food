/**
 * POST /api/webhooks/stripe
 *
 * Stripe calls this URL after events happen (here: a completed checkout).
 * We must:
 *   1. Verify the signature so we know the request really came from Stripe.
 *   2. On checkout.session.completed, mark the matching order PAID.
 *   3. Decrement stock for each line item (Story 1.4) — only on the first
 *      PENDING -> PAID transition, never on a replay.
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
// Sentry instead (AC #5); the webhook still returns 200.
class StockShortfallError extends Error {}

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
      // Conditional update doubles as the idempotency guard for AC #6: only
      // a call that actually flips PENDING -> PAID (count === 1) is the
      // first time we've seen this order complete, and only that call
      // should decrement stock. A replayed webhook (Stripe retries on
      // timeout/5xx) for an order already PAID matches count === 0 and
      // skips the decrement entirely - no new schema column needed, same
      // idea as the existing smsNotified one-shot guard below.
      const transition = await prisma.order.updateMany({
        where: { id: orderId, status: { not: "PAID" } },
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

      if (transition.count === 1) {
        try {
          await prisma.$transaction(async (tx) => {
            for (const item of order.items) {
              const decremented = await decrementStock(
                tx,
                item.productId,
                item.quantity,
              );
              if (!decremented) {
                throw new StockShortfallError(
                  `Insufficient stock for product ${item.productId} on order ${order.id}`,
                );
              }
            }
          });
        } catch (err) {
          if (err instanceof StockShortfallError) {
            // Payment already happened - there's nothing to "reject" at
            // this point. Surface it rather than silently swallow or
            // auto-refund (AC #5); a human resolves it (Story 3.2).
            Sentry.captureException(err);
          } else {
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
