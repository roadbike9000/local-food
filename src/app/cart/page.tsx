"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { formatPrice } from "@/lib/utils";

// The cart + checkout page. Collects customer contact info, then calls our
// /api/checkout route which creates a Stripe Checkout session and redirects.
export default function CartPage() {
  const { items, vendorId, totalCents, removeItem, updateQuantity } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          customerName: name,
          customerPhone: phone,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Checkout failed");
      }

      const { url } = await res.json();
      // Redirect the browser to Stripe's hosted payment page.
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Your cart</h1>
        <p className="mt-4 text-stone-600">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold">Your cart</h1>

      <ul className="mt-4 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {items.map((i) => (
          <li
            key={i.productId}
            className="flex items-center justify-between p-3"
          >
            <span className="flex items-center gap-2">
              <button
                aria-label={`Decrease quantity of ${i.name}`}
                disabled={i.quantity <= 1}
                onClick={() => updateQuantity(i.productId, i.quantity - 1)}
                className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <span aria-label={`Quantity of ${i.name}`} className="w-4 text-center">
                {i.quantity}
              </span>
              <button
                aria-label={`Increase quantity of ${i.name}`}
                disabled={i.quantity >= i.stockQuantity}
                onClick={() => updateQuantity(i.productId, i.quantity + 1)}
                className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
              <span className="ml-1">{i.name}</span>
            </span>
            <span className="flex items-center gap-3">
              {formatPrice(i.priceCents * i.quantity)}
              <button
                onClick={() => removeItem(i.productId)}
                className="text-xs text-stone-400 hover:text-red-600"
              >
                remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span>{formatPrice(totalCents)}</span>
      </div>

      <div className="mt-6 space-y-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        <input
          type="tel"
          placeholder="Mobile number (for pickup texts)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleCheckout}
          disabled={loading || !name || !phone}
          className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Checkout"}
        </button>
      </div>
    </div>
  );
}
