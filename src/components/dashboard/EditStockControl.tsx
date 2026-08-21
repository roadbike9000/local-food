"use client";

/**
 * Inline edit control for a product's Stock Quantity and Low-Stock
 * Threshold - the only way to correct either value after creation (Story
 * 1.2). Both fields save together via a single PATCH request. Renders as
 * two <td>s (a fragment) so the caller can give each field its own labeled
 * table column.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Postgres INTEGER max - matches the server-side Zod bound, so the browser
// rejects an overflowing value before it ever reaches the network.
const INT4_MAX = 2_147_483_647;

type EditStockControlProps = {
  productId: string;
  productName: string;
  initialStockQuantity: number;
  initialLowStockThreshold: number;
  initialStockVersion: number;
};

function parseWholeNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= INT4_MAX ? value : null;
}

export function EditStockControl({
  productId,
  productName,
  initialStockQuantity,
  initialLowStockThreshold,
  initialStockVersion,
}: EditStockControlProps) {
  const router = useRouter();
  const [stockInput, setStockInput] = useState(String(initialStockQuantity));
  const [thresholdInput, setThresholdInput] = useState(
    String(initialLowStockThreshold),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync from the server's value after a router.refresh() (success) or a
  // reload - without this, a stale typed value keeps showing even when the
  // server disagrees.
  useEffect(() => {
    setStockInput(String(initialStockQuantity));
  }, [initialStockQuantity]);

  useEffect(() => {
    setThresholdInput(String(initialLowStockThreshold));
  }, [initialLowStockThreshold]);

  async function handleSave() {
    // Held as raw strings (not numbers) so an emptied input doesn't
    // silently coerce to 0 - Number("") === 0, which would otherwise
    // persist "sold out" the moment a vendor backspaces the field.
    const stockQuantity = parseWholeNumber(stockInput);
    const lowStockThreshold = parseWholeNumber(thresholdInput);
    if (stockQuantity === null || lowStockThreshold === null) {
      setError("Enter a whole number, 0 or greater, for both fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockQuantity,
          lowStockThreshold,
          expectedStockVersion: initialStockVersion,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not update stock. Try again.");
        if (res.status === 409) {
          // Reload the real current values now - the server's error message
          // already tells the vendor this happened, so this isn't a "try
          // again" retry, it's what makes that message true.
          router.refresh();
        }
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Clears a stale error as soon as the vendor starts correcting the
  // input it applies to, instead of leaving it displayed over a value
  // that's no longer what triggered it.
  function handleStockChange(value: string) {
    setStockInput(value);
    if (error) setError(null);
  }

  function handleThresholdChange(value: string) {
    setThresholdInput(value);
    if (error) setError(null);
  }

  const stockLabelId = `stock-qty-label-${productId}`;
  const thresholdLabelId = `stock-threshold-label-${productId}`;
  const productNameId = `stock-product-name-${productId}`;

  return (
    <>
      <td className="py-2">
        {/* Shared by both inputs' aria-labelledby, so each keeps its
            visible label text as the start of its accessible name (WCAG
            2.5.3) while still getting a per-product-unique name overall.
            Lives in this <td> (not a bare child of the fragment) because
            <tr> only permits <td>/<th> children. */}
        <span id={productNameId} className="sr-only">
          for {productName}
        </span>
        <label className="flex flex-col gap-0.5 text-xs text-stone-500">
          <span id={stockLabelId}>Stock Quantity</span>
          <input
            type="number"
            step="1"
            min="0"
            max={INT4_MAX}
            aria-labelledby={`${stockLabelId} ${productNameId}`}
            value={stockInput}
            onChange={(e) => handleStockChange(e.target.value)}
            className="w-16 rounded-md border border-stone-300 px-1.5 py-1 text-sm text-stone-900"
          />
        </label>
      </td>
      <td className="py-2">
        <div className="flex items-center gap-1.5">
          <label className="flex flex-col gap-0.5 text-xs text-stone-500">
            <span id={thresholdLabelId}>Low-Stock Threshold</span>
            <input
              type="number"
              step="1"
              min="0"
              max={INT4_MAX}
              aria-labelledby={`${thresholdLabelId} ${productNameId}`}
              value={thresholdInput}
              onChange={(e) => handleThresholdChange(e.target.value)}
              className="w-16 rounded-md border border-stone-300 px-1.5 py-1 text-sm text-stone-900"
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSave}
            aria-label={`Save stock changes for ${productName}`}
            className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {error ? (
          <p role="alert" aria-live="polite" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </td>
    </>
  );
}
