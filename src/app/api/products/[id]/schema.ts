import { z } from "zod";

export const UpdateProductStockSchema = z.object({
  stockQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  // The stockQuantity value the vendor's form last loaded - setStock()'s
  // optimistic-lock guard (AD-3) checks against this.
  expectedStockQuantity: z.number().int().nonnegative(),
});
