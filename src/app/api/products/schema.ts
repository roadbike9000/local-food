import { z } from "zod";

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
export const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
  // Required, no default - vendor must set both at creation (Story 1.2).
  stockQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
});
