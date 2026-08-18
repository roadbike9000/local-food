"use client";

/**
 * Inline edit control for a product's Stock Quantity and Low-Stock
 * Threshold - the only way to correct either value after creation (Story
 * 1.2). Both fields save together via a single PATCH request.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type EditStockControlProps = {
  productId: string;
  initialStockQuantity: number;
  initialLowStockThreshold: number;
};

export function EditStockControl({
  productId,
  initialStockQuantity,
  initialLowStockThreshold,
}: EditStockControlProps) {
  const router = useRouter();
  const [stockQuantity, setStockQuantity] = useState(initialStockQuantity);
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialLowStockThreshold,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockQuantity,
          lowStockThreshold,
          expectedStockQuantity: initialStockQuantity,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not update stock. Try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="1"
        min="0"
        aria-label="Stock Quantity"
        value={stockQuantity}
        onChange={(e) => setStockQuantity(Number(e.target.value))}
        className="w-16 rounded-md border border-stone-300 px-1.5 py-1 text-sm"
      />
      <input
        type="number"
        step="1"
        min="0"
        aria-label="Low-Stock Threshold"
        value={lowStockThreshold}
        onChange={(e) => setLowStockThreshold(Number(e.target.value))}
        className="w-16 rounded-md border border-stone-300 px-1.5 py-1 text-sm"
      />
      <button
        type="button"
        disabled={submitting}
        onClick={handleSave}
        className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        Save
      </button>
      {error ? (
        <p role="alert" aria-live="polite" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
