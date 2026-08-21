import { z } from "zod";

// Postgres INTEGER max - stockQuantity/lowStockThreshold are Int columns,
// and a value above this overflows at the DB layer with an opaque 500
// instead of a clean 400.
const INT4_MAX = 2_147_483_647;

export const UpdateProductStockSchema = z.object({
  stockQuantity: z.number().int().nonnegative().max(INT4_MAX),
  lowStockThreshold: z.number().int().nonnegative().max(INT4_MAX),
  // The stockVersion value the vendor's form last loaded - setStock()'s
  // optimistic-lock guard (AD-3) checks against this. Keyed on the
  // monotonic version counter, not stockQuantity itself, so a
  // decrement-then-restock that returns stockQuantity to the same value
  // is still caught (ABA race - Story 1.2 deferred-work finding).
  expectedStockVersion: z.number().int().nonnegative().max(INT4_MAX),
  // "Confirm as-is" (deferred-work.md, Story 1.2): a vendor whose value
  // genuinely is the placeholder default has no other way to clear
  // stockIsPlaceholder/thresholdIsPlaceholder without a two-step
  // change-then-revert workaround, since both flags normally only clear on
  // a real value change. When true, the route clears whichever flag(s) are
  // currently set even though the posted values match what's already
  // stored. Optional - every other PATCH omits it, defaulting to false.
  confirmPlaceholder: z.boolean().optional(),
});
