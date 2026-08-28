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
  hourCycle: "h23", // avoids Intl rendering midnight as "24" under hour12:false
};

const WALL_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Thrown by zonedWallTimeToUtc for a malformed, nonexistent, or otherwise unrepresentable wall-clock input. */
export class InvalidWallTimeError extends Error {}

/**
 * True if `timeZone` is a timezone identifier the runtime actually
 * recognizes. `Vendor.timezone` is an unvalidated free-text DB column with
 * no write-side check anywhere in this codebase today (code review, Story
 * 6.1) — this guards every read-side use against a `RangeError` from a
 * garbage value.
 *
 * Constructs an `Intl.DateTimeFormat` and lets it validate, rather than
 * checking membership in `Intl.supportedValuesOf("timeZone")` — that list
 * excludes `"UTC"` itself (verified: `Intl.supportedValuesOf("timeZone")`
 * does not contain `"UTC"` even though it's a valid, constructible zone),
 * which would make this function wrongly reject this codebase's own
 * fallback value.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The canonical set of IANA timezone identifiers this codebase lets a
 * human choose from (Story 7.1) — `Intl.supportedValuesOf("timeZone")`'s
 * own list: modern canonical zone names only, no legacy aliases
 * (`"US/Eastern"`), fixed-offset strings (`"+05:00"`), or the `"UTC"`
 * special case `isValidTimeZone()` deliberately accepts for read-side
 * fallback use. Single source of truth for every timezone `<select>`
 * (`AddVendorForm.tsx`, `EditVendorTimezoneControl.tsx`) *and* every
 * write-path validator (`CreateVendorSchema`, `UpdateVendorSchema`) — code
 * review found `isValidTimeZone()` alone was too permissive for a write
 * path feeding a `<select>`: it accepts values (verified: `"UTC"`,
 * `"US/Eastern"`, `"+05:00"`, `"EST5EDT"`, `"GMT"`) that aren't in this
 * list, so a vendor set to one of them via a direct API call would leave
 * every `<select>` unable to display or re-select its own stored value.
 */
export const SELECTABLE_TIME_ZONES = Intl.supportedValuesOf("timeZone");
const SELECTABLE_TIME_ZONE_SET = new Set(SELECTABLE_TIME_ZONES);

/** True if `timeZone` is in `SELECTABLE_TIME_ZONES` — the stricter check for a write path that must stay in sync with a `<select>`'s own option list. */
export function isSelectableTimeZone(timeZone: string): boolean {
  return SELECTABLE_TIME_ZONE_SET.has(timeZone);
}

function offsetAtInstant(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", { ...ZONED_PARTS_FORMAT, timeZone });
  const parts = Object.fromEntries(dtf.formatToParts(instant).map((p) => [p.type, p.value]));
  const displayedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return displayedAsUtc - instant.getTime();
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" wall-clock string (no offset info, as
 * produced by a `datetime-local` input's `.value`) interpreted as being in
 * `timeZone` into the UTC instant it actually represents.
 *
 * Two-pass offset resolution (code review, Story 6.1): a single-pass
 * "treat the digits as naive UTC, ask what that instant displays as in the
 * target zone" lookup samples the zone's offset *at the naive instant*,
 * not at the real target instant — which can be several hours away. If a
 * DST transition falls in that gap, the stale pre-transition offset gets
 * applied, silently producing a UTC instant off by the DST delta for every
 * wall-clock time in that window (verified: for America/New_York this is
 * wrong for 03:00-06:59 on the spring-forward day and 02:00-05:59 on the
 * fall-back day — not just the transition hour itself). Re-resolving the
 * offset at the first pass's *candidate* result, then re-deriving, corrects
 * for this: DST changes at most once between the two estimates, so one
 * refinement converges.
 *
 * After resolving, round-trips the result back through
 * utcInstantToZonedDatetimeLocal and compares to the input — this single
 * check also catches a wall-clock time that never existed at all (the hour
 * skipped by a spring-forward transition), which no offset arithmetic can
 * "resolve" to a correct answer, only detect.
 */
export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date {
  if (!WALL_TIME_PATTERN.test(wallTime)) {
    throw new InvalidWallTimeError(`Malformed wall-clock string: "${wallTime}"`);
  }
  const naiveUtc = new Date(`${wallTime}:00Z`);
  if (Number.isNaN(naiveUtc.getTime())) {
    throw new InvalidWallTimeError(`Malformed wall-clock string: "${wallTime}"`);
  }

  const firstPassOffset = offsetAtInstant(naiveUtc, timeZone);
  const candidate = new Date(naiveUtc.getTime() - firstPassOffset);
  const refinedOffset = offsetAtInstant(candidate, timeZone);
  const result = new Date(naiveUtc.getTime() - refinedOffset);

  if (utcInstantToZonedDatetimeLocal(result, timeZone) !== wallTime) {
    throw new InvalidWallTimeError(
      `"${wallTime}" does not exist in ${timeZone} — likely a DST spring-forward gap`,
    );
  }

  return result;
}

/**
 * Formats a UTC instant as a "YYYY-MM-DDTHH:mm" wall-clock string in the
 * given `timeZone` — the inverse direction of zonedWallTimeToUtc, used for
 * `AddSlotForm.tsx`'s `min` attribute (vendor-timezone-aware "now"). Simpler
 * than the other direction: no offset math needed, `formatToParts` already
 * returns the target zone's wall-clock components directly for a given
 * instant.
 *
 * Falls back to "UTC" for an invalid `timeZone` rather than throwing
 * (code review, Story 6.1) — this is a display/render-path helper (used
 * directly in JSX, not behind a try/catch), so degrading gracefully is
 * preferable to crashing the page for a bad `Vendor.timezone` value.
 */
export function utcInstantToZonedDatetimeLocal(date: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const dtf = new Intl.DateTimeFormat("en-US", { ...ZONED_PARTS_FORMAT, timeZone: zone });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
