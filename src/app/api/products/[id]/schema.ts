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
});
