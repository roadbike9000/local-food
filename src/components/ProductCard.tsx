"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/utils";
import { isInStock } from "@/lib/availability";

// A small thumbnail for a compact row layout - no pixel-exact requirement,
// just large enough to be recognizable next to the name/price text.
const IMAGE_SIZE = 64;

type ProductCardProps = {
  vendorId: string;
  vendorSlug: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    stockQuantity: number;
    imageUrl: string | null;
  };
};

// Neutral placeholder for a product with no image, or whose image failed to
// load - same slot/dimensions as the real image so layout doesn't shift. No
// icon library or /public asset exists in this codebase; a data-testid is
// used since no ARIA role identifies "an image placeholder" (same narrow
// exception src/app/cart/page.tsx's "cart-total" uses).
function ProductImagePlaceholder() {
  return (
    <div
      data-testid="product-image-placeholder"
      style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
      className="flex flex-shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-400"
    >
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}

// Client component because it has an "Add to cart" button that updates state.
export function ProductCard({ vendorId, vendorSlug, product }: ProductCardProps) {
  const { addItem } = useCart();
  const inStock = isInStock(product);
  const outOfStockId = `out-of-stock-${product.id}`;
  const [imageFailed, setImageFailed] = useState(false);
  // Resets a stale failure if this same card instance is ever reused for a
  // different (or corrected) imageUrl - currently masked by page.tsx's
  // key={p.id} giving each product its own instance, but cheap to guard
  // against any future live-update pattern reusing the instance instead of
  // remounting it (Story 4.2 review finding).
  useEffect(() => {
    setImageFailed(false);
  }, [product.imageUrl]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4">
      {product.imageUrl && !imageFailed ? (
        <Image
          src={product.imageUrl}
          // Decorative relative to the adjacent, already-visible product
          // name heading - a non-empty alt would have a screen reader
          // announce the same text twice per card (Story 4.2 review
          // finding).
          alt=""
          data-testid="product-image"
          width={IMAGE_SIZE}
          height={IMAGE_SIZE}
          className="flex-shrink-0 rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ProductImagePlaceholder />
      )}
      <div className="flex-1">
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
            stockQuantity: product.stockQuantity,
          });
        }}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
