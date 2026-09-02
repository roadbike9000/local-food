"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { NegativeBadge } from "@/components/NegativeBadge";
import { formatPickupWindow, formatPrice } from "@/lib/utils";
import { isValidTimeZone } from "@/lib/timezone";

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

// Shared by the stepper's decrease/increase buttons so their styling can't
// drift out of sync (Story 8.4 review).
const STEPPER_BUTTON_CLASS =
  "focus-ring flex h-[30px] w-[30px] items-center justify-center bg-cream font-sans font-bold text-terracotta disabled:cursor-not-allowed disabled:opacity-40";

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
    // Reset alongside the rest of this state when the vendor changes, not
    // just on the initial mount (code review, Story 6.1) — without this, a
    // vendor switch briefly re-renders the *previous* vendor's slots in the
    // *previous* vendor's timezone until the new fetch resolves.
    setVendorTimezone("UTC");
    if (!vendorId) return;

    let cancelled = false;
    fetch(`/api/vendors/${vendorId}/pickup-slots`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load pickup times");
        return res.json();
      })
      .then((data: { slots: PickupSlotOption[]; timezone: unknown }) => {
        if (cancelled) return;
        setSlots(data.slots);
        // data.timezone is cast from res.json(), not runtime-checked by the
        // type annotation alone (code review, Story 6.1) — a missing/bad
        // field here must not silently fall through to Intl's own
        // browser-zone default, since that's the exact bug this story
        // exists to fix.
        setVendorTimezone(
          typeof data.timezone === "string" && isValidTimeZone(data.timezone)
            ? data.timezone
            : "UTC",
        );
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
        <h1 className="font-serif text-display-xs text-terracotta-deep">
          Your cart
        </h1>
        <p className="mt-4 font-sans text-body-ui text-ink-soft">
          Your cart is empty.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-display-xs text-terracotta-deep">
        Your cart
      </h1>

      <div className="mt-section-gap grid grid-cols-[1.55fr_1fr] items-start gap-grid-gap">
        <div>
          <ul className="flex flex-col gap-list-gap">
            {items.map((i) => (
              <li
                key={i.productId}
                className="rounded-storefront-md border border-card-border bg-paper p-[18px] shadow-row"
              >
                <div className="flex items-center justify-between gap-panel-gap">
                  <span className="flex flex-1 items-center gap-3">
                    <span className="flex items-center overflow-hidden rounded-full border border-field-border bg-paper">
                      <button
                        aria-label={`Decrease quantity of ${i.name}`}
                        disabled={i.quantity <= 1}
                        onClick={() => updateQuantity(i.productId, -1)}
                        type="button"
                        className={STEPPER_BUTTON_CLASS}
                      >
                        −
                      </button>
                      <span
                        aria-label={`Quantity of ${i.name}`}
                        aria-live="polite"
                        className="min-w-[30px] text-center font-sans text-ui-sm font-bold text-ink"
                      >
                        {i.quantity}
                      </span>
                      <button
                        aria-label={`Increase quantity of ${i.name}`}
                        disabled={i.quantity >= i.stockQuantity}
                        onClick={() => updateQuantity(i.productId, 1)}
                        type="button"
                        className={STEPPER_BUTTON_CLASS}
                      >
                        +
                      </button>
                    </span>
                    <span className="font-serif text-item-title text-ink">
                      {i.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-sans text-price text-terracotta-deep">
                      {formatPrice(i.priceCents * i.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(i.productId)}
                      className="focus-ring font-sans text-ui-sm text-ink-soft hover:text-terracotta-deep"
                    >
                      remove
                    </button>
                  </span>
                </div>
                {i.stockQuantity <= 0 && (
                  // role="alert" already implies an assertive live region -
                  // an explicit aria-live="polite" here would override that
                  // and silently downgrade the announcement (ARIA spec).
                  <p role="alert" className="mt-1 font-sans text-ui-sm text-red-600">
                    No longer available — remove to continue.
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div
            data-testid="cart-total"
            className="mt-panel-gap flex items-baseline justify-end gap-3 border-t-2 border-dashed border-line pt-[18px]"
          >
            <span className="font-sans text-label-caps-tight uppercase text-ink-soft">
              Total
            </span>
            <span className="font-serif text-total-display text-terracotta-deep">
              {formatPrice(totalCents)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-panel-gap rounded-storefront-lg border border-card-border bg-paper p-[26px_24px] shadow-card">
          <div>
            <p className="mb-tight text-label-caps-tight font-sans uppercase text-olive">
              Your Details
            </p>
            <div className="flex flex-col gap-tight">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="focus-ring w-full rounded-storefront-sm border border-field-border bg-cream px-[14px] py-[11px] font-sans text-body-ui text-ink placeholder:text-placeholder-text"
              />
              <input
                type="tel"
                placeholder="Mobile number (for pickup texts)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="focus-ring w-full rounded-storefront-sm border border-field-border bg-cream px-[14px] py-[11px] font-sans text-body-ui text-ink placeholder:text-placeholder-text"
              />
            </div>
          </div>

          <div>
            <p
              id="pickup-time-heading"
              className="mb-tight text-label-caps-tight font-sans uppercase text-olive"
            >
              Pickup Time
            </p>

            {!slotsLoaded && (
              <p className="font-sans text-body-ui text-ink-soft">
                Loading pickup times…
              </p>
            )}

            {slotsLoaded && slotsError && (
              <p role="alert" className="font-sans text-body-ui text-red-600">
                Could not load pickup times. Try refreshing the page.
              </p>
            )}

            {slotsLoaded && !slotsError && slots.length === 0 && (
              <p className="font-sans text-body-ui text-ink-soft">
                No pickup times available.
              </p>
            )}

            {slotsLoaded && !slotsError && slots.length === 1 && (
              <p className="font-sans text-body-ui text-ink">
                <span className="font-semibold">Pickup: </span>
                {formatPickupWindow(new Date(slots[0].startsAt), new Date(slots[0].endsAt), vendorTimezone)}
                {slots[0].location ? ` · ${slots[0].location}` : ""}
                {!slots[0].available && (
                  <NegativeBadge className="ml-2 inline-block">Full</NegativeBadge>
                )}
              </p>
            )}

            {slotsLoaded && !slotsError && slots.length >= 2 && (
              <fieldset
                aria-labelledby="pickup-time-heading"
                className="flex flex-col gap-2.5"
              >
                <legend className="sr-only">Pickup time</legend>
                {slots.map((slot) => (
                  <label
                    key={slot.id}
                    className={`flex items-center gap-3 rounded-storefront border px-[14px] py-[13px] font-sans text-ui-sm ${
                      selectedSlotId === slot.id
                        ? "border-terracotta bg-selected-wash ring-1 ring-inset ring-terracotta"
                        : slot.available
                          ? "border-line bg-paper text-ink"
                          : "border-line bg-sold-out-bg text-ink-soft"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pickupSlot"
                      value={slot.id}
                      checked={selectedSlotId === slot.id}
                      disabled={!slot.available}
                      onChange={() => setSelectedSlotId(slot.id)}
                      className="focus-ring h-[18px] w-[18px] flex-shrink-0 accent-terracotta"
                    />
                    <span className="flex-1">
                      {formatPickupWindow(new Date(slot.startsAt), new Date(slot.endsAt), vendorTimezone)}
                      {slot.location ? ` · ${slot.location}` : ""}
                    </span>
                    {!slot.available && <NegativeBadge>Full</NegativeBadge>}
                  </label>
                ))}
              </fieldset>
            )}
          </div>

          {error && (
            <p role="alert" className="font-sans text-body-ui text-red-600">
              {error}
            </p>
          )}
          <button
            onClick={handleCheckout}
            disabled={loading || !name || !phone || !selectedSlotId}
            className="focus-ring w-full rounded-full bg-terracotta px-[26px] py-[14px] font-sans text-[15px] font-bold tracking-[0.02em] text-paper shadow-button-primary hover:bg-terracotta-deep disabled:cursor-not-allowed disabled:bg-sold-out-bg disabled:text-ink-soft disabled:shadow-none"
          >
            {loading ? "Redirecting…" : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
