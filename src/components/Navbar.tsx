"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "./CartProvider";
import { BasketIcon } from "./Icons";
import { formatCartBadgeText, formatCartCountLabel } from "@/lib/cart";

export function Navbar() {
  const { items } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const countLabel = formatCartCountLabel(count);
  const badgeText = formatCartBadgeText(count);

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
            className="focus-ring flex items-center gap-2 rounded-full border border-line bg-cream py-[7px] pl-3 pr-4 text-body-ui text-ink hover:border-terracotta"
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
              (e.g. clicking "Add" on a product page) without double-reading
              the link's own aria-label on every render - empty at count 0
              so mount doesn't announce anything. */}
          <span aria-live="polite" className="sr-only">
            {count > 0 ? `Cart, ${countLabel}` : ""}
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
