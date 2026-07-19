"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useCart } from "./CartProvider";

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
          <Link href="/cart" className="relative hover:text-brand">
            Cart
            {count > 0 && (
              <span className="absolute -right-4 -top-2 rounded-full bg-brand px-1.5 text-xs text-white">
                {count}
              </span>
            )}
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
