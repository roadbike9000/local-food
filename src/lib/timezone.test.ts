import { describe, expect, it } from "vitest";
import { zonedWallTimeToUtc, utcInstantToZonedDatetimeLocal } from "./timezone";

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
});
