/**
 * POST /api/checkout
 *
 * Creates a PENDING order in our database, then a Stripe Checkout session, and
 * returns the Stripe URL for the browser to redirect to. Payment itself happens
 * on Stripe's hosted page; we get told about success via the webhook.
 *
 * We look up prices from OUR database (never trust prices sent by the browser).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { CheckoutSchema } from "./schema";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { vendorId, customerName, customerPhone, items } = parsed.data;

  // Load the real products so we control the prices. Fetched regardless of
  // stock so the checks below can tell "doesn't exist / wrong vendor" apart
  // from "exists but insufficient stock" (architecture AD-2).
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, vendorId },
  });

  if (products.length !== items.length) {
    return NextResponse.json(
      { error: "One or more items are unavailable" },
      { status: 400 },
    );
  }

  // Per-line stock sufficiency, not just existence (AD-2) - reject the
  // whole order if any line is short, before creating anything.
  const hasInsufficientStock = items.some((i) => {
    const product = products.find((p) => p.id === i.productId)!;
    return product.stockQuantity < i.quantity;
  });
  if (hasInsufficientStock) {
    return NextResponse.json(
      { error: "One or more items don't have enough stock" },
      { status: 400 },
    );
  }

  // Build order line items and total from trusted DB prices.
  const lineItems = items.map((i) => {
    const product = products.find((p) => p.id === i.productId)!;
    return {
      product,
      quantity: i.quantity,
      unitPriceCents: product.priceCents,
    };
  });

  const totalCents = lineItems.reduce(
    (sum, li) => sum + li.unitPriceCents * li.quantity,
    0,
  );

  // Create the order in PENDING state first.
  const order = await prisma.order.create({
    data: {
      vendorId,
      customerName,
      customerPhone,
      totalCents,
      status: "PENDING",
      items: {
        create: lineItems.map((li) => ({
          productId: li.product.id,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
        })),
      },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create the Stripe Checkout session.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems.map((li) => ({
      quantity: li.quantity,
      price_data: {
        currency: "usd",
        unit_amount: li.unitPriceCents,
        product_data: { name: li.product.name },
      },
    })),
    // metadata travels with the session and comes back on the webhook so we can
    // find and confirm the right order.
    metadata: { orderId: order.id },
    success_url: `${appUrl}/checkout/success`,
    cancel_url: `${appUrl}/cart`,
  });

  // Save the Stripe session id so the webhook can match it back.
  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
