import { z } from "zod";

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
//
// Create-only: the past-startsAt refine below makes this schema's result
// depend on wall-clock time at call time, not just its input — reusing it
// to validate an existing/stored slot (e.g. an edit endpoint) would wrongly
// reject any slot that has already started. Don't reuse for that.
export const CreateSlotSchema = z
  .object({
    // { offset: true } accepts any valid ISO 8601 UTC-offset suffix
    // (e.g. "+00:00"), not just "Z" — Zod v3's default `datetime()` only
    // accepts "Z". This app always sends "Z" (`.toISOString()`), but a
    // direct API caller sending a spec-valid offset shouldn't get an
    // unexplained 400.
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    capacity: z.number().int().positive().default(20),
    location: z.string().optional(),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: "endsAt must be after startsAt",
  })
  // FR16: a slot can't be created already in the past. Server time (new
  // Date() here, evaluated in the route handler) is authoritative, not
  // the vendor's device clock/timezone (NFR2).
  .refine((d) => new Date(d.startsAt) > new Date(), {
    message: "startsAt must not be in the past",
  });
