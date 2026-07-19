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

export type CartItem = {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
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
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
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
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
