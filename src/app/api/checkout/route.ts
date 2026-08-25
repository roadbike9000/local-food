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
import { assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { CheckoutSchema } from "./schema";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { vendorId, pickupSlotId, customerName, customerPhone, items } = parsed.data;

  // Vendor-active check first (Story 2.3, AD-4) - fail fast before
  // bothering to query products for a bad/deactivated vendor. This route
  // never fetched the Vendor row before this story.
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return NextResponse.json(
      { error: "One or more items are unavailable" },
      { status: 400 },
    );
  }
  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return NextResponse.json(
        { error: "This vendor is no longer accepting orders" },
        { status: 400 },
      );
    }
    throw err;
  }

  // Selected pickup slot must belong to this vendor and still exist (AC #2,
  // NFR2) - checked before the product/stock work so a bad slot fails fast,
  // same reasoning as the vendor-active check above. "Still exists" means
  // the row exists and belongs to this vendor, not that it hasn't started
  // yet - PickupSlot has no soft-delete and this story doesn't add a
  // startsAt re-check at checkout time (see story Dev Notes).
  const pickupSlot = await prisma.pickupSlot.findFirst({
    where: { id: pickupSlotId, vendorId },
  });
  if (!pickupSlot) {
    return NextResponse.json(
      { error: "Selected pickup time is no longer available" },
      { status: 400 },
    );
  }

  // A cart can list the same product across multiple lines; aggregate the
  // requested quantity per product so both checks below evaluate total
  // demand, not each line in isolation (otherwise e.g. two lines of
  // quantity 3 each would independently "pass" a stockQuantity: 4 check
  // that their combined quantity of 6 should fail).
  const quantityByProductId = new Map<string, number>();
  for (const i of items) {
    quantityByProductId.set(
      i.productId,
      (quantityByProductId.get(i.productId) ?? 0) + i.quantity,
    );
  }
  const productIds = [...quantityByProductId.keys()];

  // Load the real products so we control the prices. Fetched regardless of
  // stock so the checks below can tell "doesn't exist / wrong vendor" apart
  // from "exists but insufficient stock" (architecture AD-2).
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, vendorId },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: "One or more items are unavailable" },
      { status: 400 },
    );
  }

  // Stock sufficiency against total requested quantity per product, not
  // just existence (AD-2) - reject the whole order if any product is short,
  // before creating anything.
  const hasInsufficientStock = products.some(
    (product) => product.stockQuantity < quantityByProductId.get(product.id)!,
  );
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
      pickupSlotId,
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
