import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezone";

// Kept out of route.ts, matching ../schema.ts's precedent (Next's
// route-type checker only allows a fixed set of named exports from a
// route file). Narrowly scoped to `timezone` only (Story 7.1) — not a
// general-purpose vendor-update schema; see the story's own Dev Notes for
// why.
export const UpdateVendorSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Invalid timezone"),
});
