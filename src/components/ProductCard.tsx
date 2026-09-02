"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/utils";
import { isInStock } from "@/lib/availability";
import { ImagePlaceholderIcon } from "./Icons";

// DESIGN.md's circular-thumb component: true circle, 84px on the vendor
// page - this component's only current consumer (confirmed by grep before
// this story's restyle).
const IMAGE_SIZE = 84;

// Shared so the real-image and placeholder-image dimming stay in sync by
// construction (Story 8.3 review: previously hand-duplicated, one copy per
// branch, with no single place to update the look).
const OUT_OF_STOCK_FILTER = "opacity-60 grayscale-[70%] brightness-[85%]";

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
function ProductImagePlaceholder({ dimmed }: { dimmed: boolean }) {
  return (
    <div
      data-testid="product-image-placeholder"
      style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-cream-deep text-ink-soft shadow-thumb ${
        dimmed ? OUT_OF_STOCK_FILTER : ""
      }`}
    >
      <ImagePlaceholderIcon width={28} height={28} />
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
    <div className="flex items-center gap-panel-gap rounded-storefront-md border border-card-border bg-paper px-panel-gap py-[18px] shadow-row">
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
          className={`flex-shrink-0 rounded-full object-cover shadow-thumb ${
            inStock ? "" : OUT_OF_STOCK_FILTER
          }`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ProductImagePlaceholder dimmed={!inStock} />
      )}
      <div className="flex-1">
        <h3 className="font-serif text-item-title-lg text-ink">{product.name}</h3>
        {product.description && (
          <p className="mt-1 font-sans text-body-ui text-ink-soft">
            {product.description}
          </p>
        )}
        <p className="mt-2.5 font-sans text-price text-terracotta-deep">
          {formatPrice(product.priceCents)}
        </p>
        {!inStock && (
          <span
            id={outOfStockId}
            className="mt-1 inline-block rounded-full bg-sold-out-bg px-2.5 py-[3px] font-sans text-badge-label uppercase text-ink-soft"
          >
            Sold Out
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
        className="focus-ring flex-shrink-0 rounded-full bg-terracotta px-5 py-2.5 font-sans text-button-label text-paper shadow-button hover:bg-terracotta-deep aria-disabled:cursor-not-allowed aria-disabled:bg-sold-out-bg aria-disabled:text-ink-soft aria-disabled:shadow-none"
      >
        Add
      </button>
    </div>
  );
}
