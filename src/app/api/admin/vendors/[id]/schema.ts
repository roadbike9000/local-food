import { z } from "zod";
import { isSelectableTimeZone } from "@/lib/timezone";

// Kept out of route.ts, matching ../schema.ts's precedent (Next's
// route-type checker only allows a fixed set of named exports from a
// route file). Narrowly scoped to `timezone` only (Story 7.1) — not a
// general-purpose vendor-update schema; see the story's own Dev Notes for
// why.
//
// Validated via isSelectableTimeZone() rather than the broader
// isValidTimeZone() - this write path must stay in sync with
// EditVendorTimezoneControl.tsx's <select>, which only offers the same
// canonical list (code review finding: isValidTimeZone() alone accepts
// values, e.g. "UTC"/"US/Eastern", that aren't in that <select>'s
// options).
export const UpdateVendorSchema = z.object({
  timezone: z.string().refine(isSelectableTimeZone, "Invalid timezone"),
});
