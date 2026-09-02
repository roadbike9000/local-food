import Link from "next/link";
import { CheckmarkIcon, SquiggleFlourish } from "@/components/Icons";

// Stripe redirects the customer here after a successful payment. The actual
// order confirmation happens server-side via the webhook, not here — this page
// is just a friendly "thank you". Stateless by design (EXPERIENCE.md#Foundation)
// - no order-detail fetch, since this page structurally can't know whether the
// webhook has processed yet.
export default function CheckoutSuccessPage() {
  return (
    <div className="relative flex items-center justify-center p-[76px_40px_90px]">
      {/* Low-opacity scattered squiggle flourish (DESIGN.md#Components) -
          same asset as the section-divider, four rotated/scaled/dimmed
          instances behind the card. Static, never animated (EXPERIENCE.md
          #Interaction Primitives: no confetti, no animated burst). */}
      <SquiggleFlourish className="absolute left-[18%] top-[62px] rotate-[-12deg] scale-[1.3] opacity-[0.55]" />
      <SquiggleFlourish className="absolute right-[16%] top-[118px] rotate-[18deg] scale-[1.6] opacity-40" />
      <SquiggleFlourish className="absolute bottom-[100px] left-[22%] rotate-[6deg] scale-[1.1] opacity-40" />
      <SquiggleFlourish className="absolute bottom-[70px] right-[20%] rotate-[-16deg] scale-[1.2] opacity-[0.45]" />

      <div className="relative z-10 w-full max-w-[480px] rounded-storefront-xl border border-card-border bg-paper p-[44px_56px_40px] text-center shadow-confirm">
        <div className="mx-auto mb-panel-gap flex h-[84px] w-[84px] items-center justify-center rounded-full bg-gradient-to-br from-olive-light via-olive to-olive-deep shadow-badge-check">
          <CheckmarkIcon className="h-10 w-10 text-paper" />
        </div>
        <h1 className="mb-[14px] font-serif text-display-sm text-terracotta-deep">
          Thank you!
        </h1>
        <p className="mx-auto mb-[28px] max-w-[360px] font-serif text-body-lede italic text-ink-soft">
          Your order is confirmed. We&apos;ll text you when it&apos;s ready
          for pickup.
        </p>
        <Link
          href="/"
          className="focus-ring inline-block rounded-full bg-terracotta px-[26px] py-[14px] font-sans text-[15px] font-bold tracking-[0.02em] text-paper shadow-button-primary hover:bg-terracotta-deep"
        >
          Back to vendors
        </Link>
      </div>
    </div>
  );
}
