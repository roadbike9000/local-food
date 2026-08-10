import { z } from "zod";

// Validate the request body shape. If it doesn't match, we reject early.
// Kept out of route.ts because Next's route-type checker only allows a
// fixed set of named exports (HTTP verbs, config, etc.) from a route file.
export const CheckoutSchema = z.object({
  vendorId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(5),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});
