/**
 * Wall-clock <-> UTC conversion for an arbitrary IANA timezone, using only
 * native `Intl` (no date library exists in this codebase — see Story 6.1's
 * Dev Notes for why hand-rolling was chosen over adding one).
 */

const ZONED_PARTS_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

/**
 * Converts a "YYYY-MM-DDTHH:mm" wall-clock string (no offset info, as
 * produced by a `datetime-local` input's `.value`) interpreted as being in
 * `timeZone` into the UTC instant it actually represents.
 *
 * Technique: treat the wall-clock digits as if they were already UTC, ask
 * Intl what that instant *displays as* in the target zone, and the
 * difference between the two is the zone's offset for that instant (date-
 * dependent — DST-aware, not a fixed offset). Subtracting the offset from
 * the naive-UTC instant gives the real UTC instant.
 */
export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date {
  const naiveUtc = new Date(`${wallTime}:00Z`);

  const dtf = new Intl.DateTimeFormat("en-US", { ...ZONED_PARTS_FORMAT, timeZone });
  const parts = Object.fromEntries(dtf.formatToParts(naiveUtc).map((p) => [p.type, p.value]));

  // What naiveUtc actually displays as, in the target zone.
  const asDisplayedInZone = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24, // Intl's hour12:false can render midnight as "24"
    Number(parts.minute),
    Number(parts.second),
  );

  const offsetMs = asDisplayedInZone - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

/**
 * Formats a UTC instant as a "YYYY-MM-DDTHH:mm" wall-clock string in the
 * given `timeZone` — the inverse direction of zonedWallTimeToUtc, used for
 * `AddSlotForm.tsx`'s `min` attribute (vendor-timezone-aware "now"). Simpler
 * than the other direction: no offset math needed, `formatToParts` already
 * returns the target zone's wall-clock components directly for a given
 * instant.
 */
export function utcInstantToZonedDatetimeLocal(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", { ...ZONED_PARTS_FORMAT, timeZone });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}
