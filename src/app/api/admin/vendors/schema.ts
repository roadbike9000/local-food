import { z } from "zod";

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
export const CreateVendorSchema = z.object({
  name: z.string().min(1),
  // Format/uniqueness is resolveVendorSlug()'s job (src/lib/vendor.ts),
  // not Zod's — don't duplicate that logic here.
  slug: z.string().min(1),
  phone: z.string().optional(),
  description: z.string().optional(),
});
