"use client";

/**
 * Inline timezone editor for one row of the admin vendor list (Story 7.1).
 * PATCHes /api/admin/vendors/[id], then router.refresh() on success - same
 * shape as DeactivateVendorButton.tsx.
 *
 * The <select> only renders once the admin clicks "Edit" (code review
 * finding: rendering all ~418 options for every row unconditionally added
 * roughly 21,000 <option> elements to this page) - plain text otherwise.
 *
 * window.confirm() only when the vendor has existing pickup slots (Jeff's
 * decision, code review) - changing timezone doesn't touch a slot's
 * stored instant, but silently changes its *displayed* wall-clock time,
 * which may no longer match what a customer's SMS confirmation said.
 * DeactivateVendorButton's confirm() is the precedent for a real,
 * consequential action in this same admin table.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type EditVendorTimezoneControlProps = {
  vendorId: string;
  vendorName: string;
  currentTimezone: string;
  hasPickupSlots: boolean;
  // Computed server-side (src/app/admin/vendors/page.tsx) and passed down
  // rather than called here - see AddVendorForm.tsx's matching prop for
  // why (code review, Story 7.1: avoids a client/server ICU hydration
  // mismatch risk from Intl.supportedValuesOf() at client-component module
  // scope).
  timeZones: readonly string[];
};

export function EditVendorTimezoneControl({
  vendorId,
  vendorName,
  currentTimezone,
  hasPickupSlots,
  timeZones,
}: EditVendorTimezoneControlProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [timezone, setTimezone] = useState(currentTimezone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped to force the <select> to remount on confirm-cancel. The native
  // element already shows the just-picked option by the time onChange
  // fires (that's how it dispatches the event), so if `timezone` state
  // never changes - which it doesn't on cancel, since we return before
  // touching it - React has nothing to re-render and the DOM is left
  // showing the cancelled option instead of the real current one.
  const [selectKey, setSelectKey] = useState(0);

  async function handleChange(value: string) {
    if (
      hasPickupSlots &&
      !window.confirm(
        `${vendorName} has existing pickup slots. Changing the timezone won't move their scheduled time, but it will change how that time is *displayed* everywhere - including to customers who may already have a confirmation quoting the old time. Continue?`,
      )
    ) {
      setSelectKey((key) => key + 1);
      return;
    }

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

      setEditing(false);
      router.refresh();
    } catch {
      setTimezone(previous);
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <span className="text-xs">{timezone}</span>{" "}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-brand hover:underline"
        >
          Edit
        </button>
        {error ? (
          <p role="alert" aria-live="polite" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <select
        key={selectKey}
        aria-label={`Timezone for ${vendorName}`}
        value={timezone}
        disabled={submitting}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => !submitting && setEditing(false)}
        autoFocus
        className="rounded-md border border-stone-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {timeZones.map((tz) => (
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
