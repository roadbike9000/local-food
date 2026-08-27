/**
 * Wall-clock <-> UTC conversion for an arbitrary IANA timezone, using only
 * native `Intl` (no date library exists in this codebase — see Story 6.1's
 * Dev Notes for why hand-rolling was chosen over adding one).
 *
 * Not implemented yet — Story 6.1, Task 2. See
 * _bmad-output/implementation-artifacts/6-1-pickup-slot-times-interpreted-in-vendors-own-timezone.md
 * for the reference algorithm and required DST-boundary test coverage.
 */

/**
 * Converts a "YYYY-MM-DDTHH:mm" wall-clock string (no offset info, as
 * produced by a `datetime-local` input's `.value`) interpreted as being in
 * `timeZone` into the UTC instant it actually represents.
 */
export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date {
  throw new Error("not implemented");
}

/**
 * Formats a UTC instant as a "YYYY-MM-DDTHH:mm" wall-clock string in the
 * given `timeZone` — the inverse direction of zonedWallTimeToUtc, used for
 * `AddSlotForm.tsx`'s `min` attribute (vendor-timezone-aware "now").
 */
export function utcInstantToZonedDatetimeLocal(date: Date, timeZone: string): string {
  throw new Error("not implemented");
}
