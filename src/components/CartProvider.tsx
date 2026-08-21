"use client";

/**
 * Cart state shared across the app via React Context.
 *
 * We keep the cart in memory (React state) for this scaffold. A cart only ever
 * holds items from ONE vendor at a time, because each order is placed with a
 * single vendor. Adding an item from a different vendor replaces the cart.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clampQuantity } from "@/lib/cart";

export type CartItem = {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  // Stock Quantity known at add-to-cart time (Story 1.5). A UX hint only for
  // the cart stepper's ceiling - never re-validated against the server, may
  // go stale, and is never authoritative. Checkout's own per-line
  // sufficiency check is the sole enforcement point regardless of this
  // value (architecture AD-3).
  stockQuantity: number;
};

type CartContextValue = {
  vendorId: string | null;
  vendorSlug: string | null;
  items: CartItem[];
  totalCents: number;
  addItem: (
    vendorId: string,
    vendorSlug: string,
    item: Omit<CartItem, "quantity">,
  ) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorSlug, setVendorSlug] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(
    newVendorId: string,
    newVendorSlug: string,
    item: Omit<CartItem, "quantity">,
  ) {
    // Switching vendors clears the previous cart.
    if (vendorId && vendorId !== newVendorId) {
      setItems([{ ...item, quantity: 1 }]);
      setVendorId(newVendorId);
      setVendorSlug(newVendorSlug);
      return;
    }

    setVendorId(newVendorId);
    setVendorSlug(newVendorSlug);
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        // Refresh every field to this click's fresh values (not just
        // stockQuantity - review round 1 finding: cherry-picking one field
        // left name/priceCents silently stale if a vendor edited them
        // between two "Add" clicks) and clamp the increment against the
        // fresh ceiling, so repeat-"Add" can't exceed the same limit the
        // cart stepper enforces (AC #6).
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...item, quantity: clampQuantity(i.quantity + 1, item.stockQuantity) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  // Takes a delta (+1/-1), not an absolute target, and computes the next
  // quantity from `prev` inside the updater - review round 1 finding: a
  // caller passing a precomputed `currentQuantity + delta` bakes in a
  // stale render-time value, so two clicks landing before a re-render
  // commits could silently drop one step. Mirrors addItem's existing-item
  // branch, which already reads from `prev` for the same reason.
  function updateQuantity(productId: string, delta: number) {
    // Defence-in-depth (deferred-work.md, Story 1.5) - unreachable today
    // (both call sites in cart/page.tsx always pass +1/-1), but a
    // non-finite delta would otherwise propagate through clampQuantity's
    // Math.min/max into a NaN quantity with no guard anywhere on this
    // public context API.
    if (!Number.isFinite(delta)) return;

    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: clampQuantity(i.quantity + delta, i.stockQuantity) }
          : i,
      ),
    );
  }

  function clear() {
    setItems([]);
    setVendorId(null);
    setVendorSlug(null);
  }

  const totalCents = useMemo(
    () => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    [items],
  );

  const value: CartContextValue = {
    vendorId,
    vendorSlug,
    items,
    totalCents,
    addItem,
    removeItem,
    updateQuantity,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
