import { z } from "zod";

// Postgres INTEGER max - stockQuantity/lowStockThreshold are Int columns,
// and a value above this overflows at the DB layer with an opaque 500
// instead of a clean 400.
const INT4_MAX = 2_147_483_647;

// Scoped to this app's own Cloudinary cloud, not just the shared
// res.cloudinary.com domain — res.cloudinary.com/demo/... etc. would
// otherwise pass, letting a direct API call point imageUrl at any public
// Cloudinary asset from any account, not just one this app itself uploaded
// (Story 4.1 review finding).
export const CLOUDINARY_URL_PREFIX = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;

// Kept out of route.ts — Next's route-type checker only allows a fixed set
// of named exports (HTTP verbs, config, etc.) from a route file.
export const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive().max(INT4_MAX),
  imageUrl: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith(CLOUDINARY_URL_PREFIX),
      "imageUrl must be a Cloudinary URL",
    )
    .optional(),
  // Required, no default - vendor must set both at creation (Story 1.2).
  stockQuantity: z.number().int().nonnegative().max(INT4_MAX),
  lowStockThreshold: z.number().int().nonnegative().max(INT4_MAX),
});
