import Link from "next/link";

// Stripe redirects the customer here after a successful payment. The actual
// order confirmation happens server-side via the webhook, not here — this page
// is just a friendly "thank you".
export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-bold text-brand">Thank you!</h1>
      <p className="mt-3 text-stone-600">
        Your order is confirmed. We&apos;ll text you when it&apos;s ready for
        pickup.
      </p>
      <Link
        href="/"
        // eslint-disable-next-line local-rules/storefront-radius-tokens -- not yet restyled by Epic 8, Tailwind default intentional until then
        className="mt-6 inline-block rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark"
      >
        Back to vendors
      </Link>
    </div>
  );
}
