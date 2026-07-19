/**
 * Stripe client singleton, used by /api/checkout (create session) and
 * /api/webhooks/stripe (verify + read events).
 *
 * Do NOT add formatPrice() or any other cents-to-dollar helper here — the
 * canonical version lives in src/lib/utils.ts. A duplicate previously lived
 * in this file and was removed; this file should only ever export `stripe`.
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
