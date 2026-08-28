import { z } from "zod";

// ATDD red-phase stub (Story 7.1) — the `timezone` field exists (correctly
// typed) but isn't validated yet; dev-story adds
// `.refine(isValidTimeZone, "Invalid timezone")`. Kept out of route.ts,
// matching ../schema.ts's precedent (Next's route-type checker only
// allows a fixed set of named exports from a route file).
export const UpdateVendorSchema = z.object({
  timezone: z.string(),
});
