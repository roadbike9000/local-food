"use client";

/**
 * Inline timezone editor for one row of the admin vendor list (Story 7.1).
 * PATCHes /api/admin/vendors/[id], then router.refresh() on success - same
 * shape as DeactivateVendorButton.tsx.
 *
 * No window.confirm() (unlike DeactivateVendorButton) - changing a
 * timezone is fully reversible by changing it back, unlike deactivation's
 * real customer-facing, hard-to-undo consequence.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

// Same runtime source as AddVendorForm.tsx - no new dependency, no static
// list to keep in sync.
const TIME_ZONES = Intl.supportedValuesOf("timeZone");

type EditVendorTimezoneControlProps = {
  vendorId: string;
  vendorName: string;
  currentTimezone: string;
};

export function EditVendorTimezoneControl({
  vendorId,
  vendorName,
  currentTimezone,
}: EditVendorTimezoneControlProps) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(currentTimezone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: string) {
    const previous = timezone;
    setTimezone(value);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: value }),
      });

      if (!res.ok) {
        setTimezone(previous);
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not update timezone. Try again.");
        return;
      }

      router.refresh();
    } catch {
      setTimezone(previous);
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <select
        aria-label={`Timezone for ${vendorName}`}
        value={timezone}
        disabled={submitting}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-stone-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {TIME_ZONES.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
