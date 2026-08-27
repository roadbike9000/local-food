"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { formatPickupWindow, formatPrice } from "@/lib/utils";

// Local shape, not a Prisma model type - keeps this "use client" file from
// needing to reason about the full Prisma PickupSlot (startsAt/endsAt come
// back as ISO strings over fetch(), not Date objects, so a Prisma-typed
// field would be misleading anyway). Mirrors CartProvider's own CartItem
// pattern of a hand-defined client-side shape.
type PickupSlotOption = {
  id: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  available: boolean;
};

// The cart + checkout page. Collects customer contact info, then calls our
// /api/checkout route which creates a Stripe Checkout session and redirects.
export default function CartPage() {
  const { items, vendorId, totalCents, removeItem, updateQuantity } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<PickupSlotOption[]>([]);
  // Story 6.1 (FR17): pickup windows are displayed in the vendor's own
  // timezone, not the browser's - "UTC" only until the fetch below resolves
  // and is never actually rendered before then (no slots render until
  // slotsLoaded is true).
  const [vendorTimezone, setVendorTimezone] = useState("UTC");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  // Distinguishes "haven't fetched yet" from "fetched, genuinely zero slots"
  // (review finding) - without this, the zero-slot message paints on every
  // mount before the fetch resolves, even for vendors that do have slots.
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slotsError, setSlotsError] = useState(false);

  // Slot selection is checkout-flow-local state (Story 5.1 Dev Notes) - kept
  // here, not in CartContext, since it doesn't need to survive navigation
  // the way cart contents do.
  useEffect(() => {
    setSlots([]);
    setSelectedSlotId(null);
    setSlotsLoaded(false);
    setSlotsError(false);
    if (!vendorId) return;

    let cancelled = false;
    fetch(`/api/vendors/${vendorId}/pickup-slots`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load pickup times");
        return res.json();
      })
      .then((data: { slots: PickupSlotOption[]; timezone: string }) => {
        if (cancelled) return;
        setSlots(data.slots);
        setVendorTimezone(data.timezone);
        setSlotsLoaded(true);
        // AC #5: auto-select when there's exactly one upcoming slot - no
        // pointless click to "choose" the only option. Skipped when that
        // one slot is full - nothing to auto-select into.
        if (data.slots.length === 1 && data.slots[0].available) {
          setSelectedSlotId(data.slots[0].id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSlotsError(true);
        setSlotsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  async function handleCheckout() {
    setError(null);
    // Defense-in-depth (review finding) - the Checkout button's disabled
    // state is the primary guard, but selectedSlotId is string | null, so
    // this keeps a bypassed/future call site from ever reaching the network
    // with a null slot and getting back a generic "Invalid request".
    if (!selectedSlotId) {
      setError("Select a pickup time to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          pickupSlotId: selectedSlotId,
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
          <li key={i.productId} className="p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <button
                  aria-label={`Decrease quantity of ${i.name}`}
                  disabled={i.quantity <= 1}
                  onClick={() => updateQuantity(i.productId, -1)}
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span
                  aria-label={`Quantity of ${i.name}`}
                  aria-live="polite"
                  className="w-4 text-center"
                >
                  {i.quantity}
                </span>
                <button
                  aria-label={`Increase quantity of ${i.name}`}
                  disabled={i.quantity >= i.stockQuantity}
                  onClick={() => updateQuantity(i.productId, 1)}
                  type="button"
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
            </div>
            {i.stockQuantity <= 0 && (
              <p className="mt-1 text-xs text-red-600">
                No longer available — remove to continue.
              </p>
            )}
          </li>
        ))}
      </ul>

      <div
        data-testid="cart-total"
        className="mt-3 flex justify-between text-lg font-semibold"
      >
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

        {!slotsLoaded && (
          <p className="text-sm text-stone-600">Loading pickup times…</p>
        )}

        {slotsLoaded && slotsError && (
          <p className="text-sm text-red-600">
            Could not load pickup times. Try refreshing the page.
          </p>
        )}

        {slotsLoaded && !slotsError && slots.length === 0 && (
          <p className="text-sm text-stone-600">No pickup times available.</p>
        )}

        {slotsLoaded && !slotsError && slots.length === 1 && (
          <p className="text-sm text-stone-700">
            <span className="font-medium">Pickup: </span>
            {formatPickupWindow(new Date(slots[0].startsAt), new Date(slots[0].endsAt), vendorTimezone)}
            {slots[0].location ? ` · ${slots[0].location}` : ""}
            {!slots[0].available && (
              <span className="ml-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                Full
              </span>
            )}
          </p>
        )}

        {slotsLoaded && !slotsError && slots.length >= 2 && (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-stone-700">
              Pickup time
            </legend>
            {slots.map((slot) => (
              <label
                key={slot.id}
                className={`flex items-center gap-2 text-sm ${
                  slot.available ? "text-stone-700" : "text-stone-400"
                }`}
              >
                <input
                  type="radio"
                  name="pickupSlot"
                  value={slot.id}
                  checked={selectedSlotId === slot.id}
                  disabled={!slot.available}
                  onChange={() => setSelectedSlotId(slot.id)}
                />
                {formatPickupWindow(new Date(slot.startsAt), new Date(slot.endsAt), vendorTimezone)}
                {slot.location ? ` · ${slot.location}` : ""}
                {!slot.available && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    Full
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleCheckout}
          disabled={loading || !name || !phone || !selectedSlotId}
          className="w-full rounded-md bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Checkout"}
        </button>
      </div>
    </div>
  );
}
