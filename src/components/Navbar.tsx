"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "./CartProvider";
import { BasketIcon } from "./Icons";

export function Navbar() {
  const { items } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand">
          Local Food
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/cart"
            aria-label={`Cart, ${count} items`}
            className="focus-ring flex items-center gap-2 rounded-full border border-line bg-cream py-[7px] pl-3 pr-4 text-body-ui text-ink"
          >
            <BasketIcon className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            Cart
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-[11px] font-bold text-paper"
            >
              {count}
            </span>
          </Link>

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
