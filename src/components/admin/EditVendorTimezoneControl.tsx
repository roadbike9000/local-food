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
 *
 * The actual PATCH is debounced (code review finding): a native <select>
 * fires `change` on every keyboard arrow-key step even before the admin
 * settles on a value, which without debouncing meant a burst of writes
 * (and, worse, a burst of confirm() dialogs) for a single intended
 * selection. Debouncing changes nothing about the success-path UX - the
 * displayed value still updates immediately on each keystroke/click, and
 * the control still auto-saves with no separate Save button - it just
 * waits for keyboard input to settle before actually committing, so a
 * rapid burst collapses into the one write (and one confirm(), if
 * applicable) the admin actually intended.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const COMMIT_DELAY_MS = 400;

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
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The value to revert to if the eventual commit fails or is declined -
  // captured once when a new burst of changes starts, not re-captured on
  // every reschedule, so a multi-step keyboard burst still reverts to the
  // value from *before the burst*, not to some intermediate step within it.
  const revertValue = useRef(currentTimezone);

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  async function commit(value: string) {
    if (
      hasPickupSlots &&
      !window.confirm(
        `${vendorName} has existing pickup slots. Changing the timezone won't move their scheduled time, but it will change how that time is *displayed* everywhere - including to customers who may already have a confirmation quoting the old time. Continue?`,
      )
    ) {
      setTimezone(revertValue.current);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: value }),
      });

      if (!res.ok) {
        setTimezone(revertValue.current);
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
      setTimezone(revertValue.current);
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(value: string) {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
    } else {
      revertValue.current = timezone;
    }
    setTimezone(value);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      void commit(value);
    }, COMMIT_DELAY_MS);
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
        aria-label={`Timezone for ${vendorName}`}
        value={timezone}
        disabled={submitting}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => !submitting && !commitTimer.current && setEditing(false)}
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
