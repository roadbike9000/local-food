"use client";

/**
 * Inline create-product form for the dashboard. Toggles open from the "Add
 * product" button, POSTs to /api/products, then refreshes the server-rendered
 * product list on success.
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AddProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form element now — event.currentTarget becomes null after
    // the `await` below, since React only keeps it valid during the
    // synchronous dispatch of the event.
    const form = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const priceDollars = String(formData.get("priceDollars") ?? "");
    const priceCents = Math.round(Number(priceDollars) * 100);
    const stockQuantity = Number(formData.get("stockQuantity") ?? "");
    const lowStockThreshold = Number(formData.get("lowStockThreshold") ?? "");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          priceCents,
          stockQuantity,
          lowStockThreshold,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not create product. Check the fields and try again.");
        return;
      }

      form.reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark"
        >
          Add product
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add product"
      className="mb-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New product</h3>
        <button
          type="button"
          disabled={submitting}
          onClick={() => setOpen(false)}
          className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm text-stone-600">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={1}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm text-stone-600">
          Description
        </label>
        <input
          id="description"
          name="description"
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="priceDollars" className="block text-sm text-stone-600">
          Price (USD)
        </label>
        <input
          id="priceDollars"
          name="priceDollars"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="stockQuantity" className="block text-sm text-stone-600">
          Stock Quantity
        </label>
        <input
          id="stockQuantity"
          name="stockQuantity"
          type="number"
          step="1"
          min="0"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="lowStockThreshold" className="block text-sm text-stone-600">
          Low-Stock Threshold
        </label>
        <input
          id="lowStockThreshold"
          name="lowStockThreshold"
          type="number"
          step="1"
          min="0"
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
