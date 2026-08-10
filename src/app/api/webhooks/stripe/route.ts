/**
 * POST /api/webhooks/stripe
 *
 * Stripe calls this URL after events happen (here: a completed checkout).
 * We must:
 *   1. Verify the signature so we know the request really came from Stripe.
 *   2. On checkout.session.completed, mark the matching order PAID.
 *   3. Text the customer via Twilio.
 *
 * IMPORTANT: this route reads the RAW request body for signature verification,
 * so we do not parse it as JSON first.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendSms, orderConfirmedMessage } from "@/lib/sms";

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
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
        include: { vendor: true },
      });

      // Notify the customer once.
      if (!order.smsNotified) {
        await sendSms(
          order.customerPhone,
          orderConfirmedMessage(order.vendor.name, order.id),
        );
        await prisma.order.update({
          where: { id: order.id },
          data: { smsNotified: true },
        });
      }
    }
  }

  // Always 200 so Stripe knows we received the event.
  return NextResponse.json({ received: true });
}
