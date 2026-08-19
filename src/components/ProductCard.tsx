"use client";

import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/utils";
import { isInStock } from "@/lib/availability";

type ProductCardProps = {
  vendorId: string;
  vendorSlug: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    stockQuantity: number;
  };
};

// Client component because it has an "Add to cart" button that updates state.
export function ProductCard({ vendorId, vendorSlug, product }: ProductCardProps) {
  const { addItem } = useCart();
  const inStock = isInStock(product);
  const outOfStockId = `out-of-stock-${product.id}`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h3 className="font-medium">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-stone-600">{product.description}</p>
        )}
        <p className="mt-1 text-sm font-semibold text-brand">
          {formatPrice(product.priceCents)}
        </p>
        {!inStock && (
          <span
            id={outOfStockId}
            className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
          >
            Out of stock
          </span>
        )}
      </div>
      <button
        aria-disabled={!inStock}
        aria-describedby={inStock ? undefined : outOfStockId}
        onClick={() => {
          if (!inStock) return;
          addItem(vendorId, vendorSlug, {
            productId: product.id,
            name: product.name,
            priceCents: product.priceCents,
          });
        }}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
