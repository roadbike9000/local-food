"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "./CartProvider";
import { BasketIcon } from "./Icons";
import { formatCartBadgeText, formatCartCountLabel } from "@/lib/cart";

// How long to wait for the count to settle before announcing it (review
// round 2 deferred finding: rapid stepper clicks on /cart were queuing one
// live-region announcement per click instead of just the final value).
const CART_ANNOUNCE_DEBOUNCE_MS = 500;

export function Navbar() {
  const { items } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const countLabel = formatCartCountLabel(count);
  const badgeText = formatCartBadgeText(count);

  // Debounced separately from countLabel: the visible link/badge update
  // immediately (real-time feedback), but the screen-reader announcement
  // waits for count to stop changing so a burst of clicks reads as one
  // "Cart, N items", not N separate announcements.
  const [announcedLabel, setAnnouncedLabel] = useState("");
  useEffect(() => {
    if (count === 0) {
      setAnnouncedLabel("");
      return;
    }
    const timer = setTimeout(() => {
      setAnnouncedLabel(`Cart, ${countLabel}`);
    }, CART_ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [count, countLabel]);

  return (
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand">
          Local Food
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/cart"
            aria-label={`Cart, ${countLabel}`}
            className="focus-ring flex items-center gap-2 rounded-full border border-line bg-cream py-[7px] pl-3 pr-4 text-body-ui text-ink hover:border-terracotta hover:bg-cream-deep"
          >
            <BasketIcon className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            Cart
            <span
              aria-hidden="true"
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-paper"
            >
              {badgeText}
            </span>
          </Link>
          {/* Screen-reader-only live region: announces cart-count changes
              (e.g. clicking "Add" on a product page) so a user not
              currently focused on the cart link still hears the update -
              empty at count 0 so mount doesn't announce anything, and
              debounced (above) so rapid changes settle before announcing. */}
          <span aria-live="polite" className="sr-only">
            {announcedLabel}
          </span>

          <SignedIn>
            <Link href="/dashboard" className="hover:text-brand">
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <Link href="/sign-in" className="hover:text-brand">
              Sign in
            </Link>
          </SignedOut>
        </div>
      </nav>
    </header>
  );
}
