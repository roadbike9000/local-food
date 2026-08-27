"use client";

/**
 * Inline create-pickup-slot form for the dashboard. Toggles open from the
 * "Add slot" button, POSTs to /api/pickup-slots, then refreshes the
 * server-rendered slot list on success.
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { zonedWallTimeToUtc, utcInstantToZonedDatetimeLocal } from "@/lib/timezone";

export function AddSlotForm({ timezone }: { timezone: string }) {
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
    const startsAtLocal = String(formData.get("startsAt") ?? "");
    const endsAtLocal = String(formData.get("endsAt") ?? "");
    const capacity = Number(formData.get("capacity"));
    const location = String(formData.get("location") ?? "").trim();

    // Wall-clock digits are interpreted as being in the vendor's own
    // configured timezone, not the submitting browser's (Story 6.1, FR17) —
    // see zonedWallTimeToUtc's doc comment for why. zonedWallTimeToUtc
    // itself validates shape, rejects a nonexistent DST-gap wall time, and
    // rejects a bad timezone — all by throwing, so both calls need to be
    // inside this try (code review, Story 6.1: an earlier version called
    // these before the try block, so a thrown error left `submitting`
    // stuck true with no error shown — the form went permanently dead).
    let startsAt: Date;
    let endsAt: Date;
    try {
      startsAt = zonedWallTimeToUtc(startsAtLocal, timezone);
      endsAt = zonedWallTimeToUtc(endsAtLocal, timezone);
    } catch {
      setError("Enter valid start and end times.");
      setSubmitting(false);
      return;
    }
    if (endsAt <= startsAt) {
      setError("End time must be after start time.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch("/api/pickup-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          capacity,
          location: location || undefined,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not create slot. Check the fields and try again.");
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
          Add slot
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New pickup slot</h3>
        <button
          type="button"
          disabled={submitting}
          onClick={() => setOpen(false)}
          className="text-sm text-stone-500 hover:text-stone-700 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startsAt" className="block text-sm text-stone-600">
            Starts
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            min={utcInstantToZonedDatetimeLocal(new Date(), timezone)}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="endsAt" className="block text-sm text-stone-600">
            Ends
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="capacity" className="block text-sm text-stone-600">
          Capacity
        </label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          min="1"
          step="1"
          defaultValue={20}
          required
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm text-stone-600">
          Location
        </label>
        <input
          id="location"
          name="location"
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
        {submitting ? "Saving…" : "Save slot"}
      </button>
    </form>
  );
}
