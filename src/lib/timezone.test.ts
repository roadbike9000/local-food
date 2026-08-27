import { describe, expect, it } from "vitest";
import {
  zonedWallTimeToUtc,
  utcInstantToZonedDatetimeLocal,
  isValidTimeZone,
  InvalidWallTimeError,
} from "./timezone";

describe("zonedWallTimeToUtc", () => {
  // America/New_York is UTC-5 in winter (EST, no DST in effect).
  it("converts a wall-clock time in a zone behind UTC (winter, no DST)", () => {
    const result = zonedWallTimeToUtc("2026-01-15T09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  // Asia/Tokyo is always UTC+9 — no DST at all, a useful zone-ahead-of-UTC
  // case with no seasonal variable to account for.
  it("converts a wall-clock time in a zone ahead of UTC (no DST)", () => {
    const result = zonedWallTimeToUtc("2026-06-15T09:00", "Asia/Tokyo");
    expect(result.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  // America/New_York is UTC-4 in summer (EDT, DST in effect) — same zone as
  // the winter case above, different offset, proving the function actually
  // resolves the offset for the given date rather than hardcoding one.
  it("converts a wall-clock time in a zone behind UTC (summer, DST in effect)", () => {
    const result = zonedWallTimeToUtc("2026-07-15T09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  // 2026 US DST spring-forward: America/New_York jumps from EST (UTC-5) to
  // EDT (UTC-4) at 2026-03-08T02:00 local, which becomes 03:00 local
  // instantly — the wall-clock hour 02:xx literally does not exist that
  // day. A vendor is very unlikely to type that exact nonexistent hour, but
  // the offset used for any time *after* the jump must be the new one
  // (UTC-4), not the stale pre-jump one (UTC-5) — this is exactly the bug
  // class a naive/cached-offset implementation gets wrong.
  it("uses the correct post-jump offset for a time shortly after DST spring-forward", () => {
    const result = zonedWallTimeToUtc("2026-03-08T09:00", "America/New_York");
    // 09:00 EDT (UTC-4) on the spring-forward day itself.
    expect(result.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  // The day immediately before spring-forward is still EST (UTC-5) — proves
  // the function doesn't apply the new offset too early.
  it("uses the correct pre-jump offset for a time on the day before DST spring-forward", () => {
    const result = zonedWallTimeToUtc("2026-03-07T09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-03-07T14:00:00.000Z");
  });

  // 2026 US DST fall-back: America/New_York jumps from EDT (UTC-4) back to
  // EST (UTC-5) at 2026-11-01T02:00 EDT (which becomes 01:00 EST) — the
  // wall-clock hour 01:xx occurs *twice* that day. This test only checks a
  // time safely after the ambiguous hour, where the offset is unambiguously
  // the new one (UTC-5).
  it("uses the correct post-jump offset for a time shortly after DST fall-back", () => {
    const result = zonedWallTimeToUtc("2026-11-01T09:00", "America/New_York");
    // 09:00 EST (UTC-5) on the fall-back day itself.
    expect(result.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  // The day immediately before fall-back is still EDT (UTC-4) — proves the
  // function doesn't apply the new offset too early.
  it("uses the correct pre-jump offset for a time on the day before DST fall-back", () => {
    const result = zonedWallTimeToUtc("2026-10-31T09:00", "America/New_York");
    expect(result.toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });

  // UTC itself is a valid, always-zero-offset case worth pinning explicitly.
  it("treats UTC as a zero offset", () => {
    const result = zonedWallTimeToUtc("2026-06-15T09:00", "UTC");
    expect(result.toISOString()).toBe("2026-06-15T09:00:00.000Z");
  });

  // Code review, Story 6.1: the original DST tests above all sampled 09:00,
  // which sits *outside* the window a single-pass "resolve the offset at
  // the naive instant" implementation gets wrong. A single-pass
  // implementation looks up the offset at the wall-clock digits reinterpreted
  // as UTC (e.g. "03:00" treated as "03:00Z") rather than at the real
  // target instant several hours later - if the DST transition falls
  // between those two instants, the stale offset gets applied. For
  // America/New_York that window is roughly 03:00-06:59 local on the
  // spring-forward day and 02:00-05:59 local on the fall-back day. Every
  // expected value below was independently cross-checked against Python's
  // zoneinfo (the IANA tz database), not derived from this implementation.
  describe("the actual DST-transition window a naive single-pass offset lookup gets wrong", () => {
    it.each([
      ["2026-03-08T03:00", "2026-03-08T07:00:00.000Z"],
      ["2026-03-08T04:00", "2026-03-08T08:00:00.000Z"],
      ["2026-03-08T05:00", "2026-03-08T09:00:00.000Z"],
      ["2026-03-08T06:00", "2026-03-08T10:00:00.000Z"],
    ])("spring-forward: %s -> %s", (wallTime, expectedIso) => {
      expect(zonedWallTimeToUtc(wallTime, "America/New_York").toISOString()).toBe(expectedIso);
    });

    it.each([
      ["2026-11-01T02:00", "2026-11-01T07:00:00.000Z"],
      ["2026-11-01T03:00", "2026-11-01T08:00:00.000Z"],
      ["2026-11-01T04:00", "2026-11-01T09:00:00.000Z"],
      ["2026-11-01T05:00", "2026-11-01T10:00:00.000Z"],
    ])("fall-back: %s -> %s", (wallTime, expectedIso) => {
      expect(zonedWallTimeToUtc(wallTime, "America/New_York").toISOString()).toBe(expectedIso);
    });
  });

  // The spring-forward transition skips an hour entirely - "02:30" never
  // happens in America/New_York on 2026-03-08 (clocks jump straight from
  // 02:00:00 to 03:00:00). No offset arithmetic can produce a "correct"
  // answer for a wall time that never existed; the only honest behavior is
  // to reject it, which the round-trip check inside zonedWallTimeToUtc
  // does.
  it("rejects a wall-clock time that doesn't exist (spring-forward gap)", () => {
    expect(() => zonedWallTimeToUtc("2026-03-08T02:30", "America/New_York")).toThrow(
      InvalidWallTimeError,
    );
  });

  // The fall-back transition repeats an hour - "01:30" occurs twice on
  // 2026-11-01 (once as EDT, once as EST an hour later). Pinning the
  // resolved policy explicitly (earlier/EDT occurrence) rather than leaving
  // it as unspecified behavior - verified against zoneinfo's fold=0 result.
  it("resolves an ambiguous wall-clock time (fall-back repeated hour) to its earlier occurrence", () => {
    const result = zonedWallTimeToUtc("2026-11-01T01:30", "America/New_York");
    expect(result.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects a malformed wall-clock string", () => {
    expect(() => zonedWallTimeToUtc("", "America/New_York")).toThrow(InvalidWallTimeError);
    expect(() => zonedWallTimeToUtc("not-a-date", "America/New_York")).toThrow(
      InvalidWallTimeError,
    );
    expect(() => zonedWallTimeToUtc("2026-01-15T10:00:30", "America/New_York")).toThrow(
      InvalidWallTimeError,
    );
  });
});

describe("isValidTimeZone", () => {
  it("accepts a real IANA identifier", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects a made-up identifier", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("utcInstantToZonedDatetimeLocal", () => {
  it("formats a UTC instant as a wall-clock string in a zone behind UTC", () => {
    const result = utcInstantToZonedDatetimeLocal(
      new Date("2026-01-15T14:00:00.000Z"),
      "America/New_York",
    );
    expect(result).toBe("2026-01-15T09:00");
  });

  it("formats a UTC instant as a wall-clock string in a zone ahead of UTC", () => {
    const result = utcInstantToZonedDatetimeLocal(
      new Date("2026-06-15T00:00:00.000Z"),
      "Asia/Tokyo",
    );
    expect(result).toBe("2026-06-15T09:00");
  });

  // Round-trips through the DST spring-forward boundary case above — proves
  // the two functions agree with each other, not just with independently
  // hand-computed expected strings.
  it("round-trips with zonedWallTimeToUtc across a DST boundary", () => {
    const wallTime = "2026-03-08T09:00";
    const utc = zonedWallTimeToUtc(wallTime, "America/New_York");
    const roundTripped = utcInstantToZonedDatetimeLocal(utc, "America/New_York");
    expect(roundTripped).toBe(wallTime);
  });

  // Code review, Story 6.1: this is a display/render-path helper (used
  // directly in AddSlotForm.tsx's JSX, not behind a try/catch) - falls back
  // to UTC for a bad Vendor.timezone value rather than throwing and
  // crashing the render.
  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    const result = utcInstantToZonedDatetimeLocal(
      new Date("2026-01-15T14:00:00.000Z"),
      "Not/AZone",
    );
    expect(result).toBe("2026-01-15T14:00");
  });
});
