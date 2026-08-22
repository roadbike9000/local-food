"use client";

/**
 * Deactivate button for one row of the admin vendor list. POSTs to
 * /api/admin/vendors/[id]/deactivate, then router.refresh() on success.
 *
 * window.confirm() before submitting - no other precedent for this in the
 * codebase, but deactivation has a real customer-facing consequence
 * (blocks checkout platform-wide for that vendor) and is only reversible
 * via direct DB access (no reactivate UI), so a native confirmation is
 * warranted here specifically, not a pattern to reach for by default.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeactivateVendorButtonProps = {
  vendorId: string;
  vendorName: string;
};

export function DeactivateVendorButton({
  vendorId,
  vendorName,
}: DeactivateVendorButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        `Deactivate ${vendorName}? Customers won't be able to order from them anymore.`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/deactivate`, {
        method: "POST",
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not deactivate vendor. Try again.");
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
    <div>
      <button
        type="button"
        disabled={submitting}
        onClick={handleClick}
        aria-label={`Deactivate ${vendorName}`}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? "Deactivating…" : "Deactivate"}
      </button>
      {error ? (
        <p role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
