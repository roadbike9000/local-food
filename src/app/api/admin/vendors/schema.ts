import { z } from "zod";
import { isSelectableTimeZone } from "@/lib/timezone";

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
export const CreateVendorSchema = z.object({
  // .trim() before .min(1) so a whitespace-only value is rejected, not
  // silently accepted as a "valid" 1+ character string (review finding —
  // AddProductForm's form trims name client-side, but nothing enforced
  // it server-side here).
  name: z.string().trim().min(1),
  // Format/uniqueness is resolveVendorSlug()'s job (src/lib/vendor.ts),
  // not Zod's — don't duplicate that logic here.
  slug: z.string().trim().min(1),
  phone: z.string().optional(),
  description: z.string().optional(),
  // IANA timezone identifier (Story 7.1, FR18). Validated via
  // isSelectableTimeZone() (src/lib/timezone.ts) rather than the broader
  // isValidTimeZone() — this write path must stay in sync with
  // AddVendorForm.tsx's <select>, which only offers the same canonical
  // list (code review finding: isValidTimeZone() alone accepts values,
  // e.g. "UTC"/"US/Eastern", that aren't in that <select>'s options).
  timezone: z.string().refine(isSelectableTimeZone, "Invalid timezone").default("America/New_York"),
});
