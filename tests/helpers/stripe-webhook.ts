/**
 * Builds signed `checkout.session.completed` payloads for
 * POST /api/webhooks/stripe, using Stripe's own test-header helper so the
 * route's real `stripe.webhooks.constructEvent` signature check is exercised
 * end to end — no mocking of Stripe, per project policy.
 */
import { stripe } from "@/lib/stripe";

export function buildCheckoutCompletedPayload(
  orderId: string,
  // Defaults to the same deterministic id every existing test already
  // relies on. Only the webhook's session.id-cross-check test needs to
  // pass something else, to prove a mismatch against Order.stripeSessionId
  // is caught - see that test for why.
  sessionId: string = `cs_test_${orderId}`,
  // Defaults to "paid" - real card-based Checkout completes with
  // payment_status: "paid" immediately, which is what every existing test
  // here has always implicitly assumed. Only the async-payment tests need
  // "unpaid" (a delayed-notification method's session completing before
  // money actually clears).
  paymentStatus: string = "paid",
) {
  return JSON.stringify({
    id: `evt_test_${orderId}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: paymentStatus,
        metadata: { orderId },
      },
    },
  });
}

/** Same shape as checkout.session.completed's payload, different event type. */
export function buildAsyncPaymentSucceededPayload(
  orderId: string,
  sessionId: string = `cs_test_${orderId}`,
) {
  return JSON.stringify({
    id: `evt_test_async_ok_${orderId}`,
    object: "event",
    type: "checkout.session.async_payment_succeeded",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        metadata: { orderId },
      },
    },
  });
}

export function buildAsyncPaymentFailedPayload(
  orderId: string,
  sessionId: string = `cs_test_${orderId}`,
) {
  return JSON.stringify({
    id: `evt_test_async_fail_${orderId}`,
    object: "event",
    type: "checkout.session.async_payment_failed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "unpaid",
        metadata: { orderId },
      },
    },
  });
}

/** Returns null (caller should skip) if STRIPE_WEBHOOK_SECRET isn't configured. */
export function signPayload(payload: string): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  return stripe.webhooks.generateTestHeaderString({ payload, secret });
}
