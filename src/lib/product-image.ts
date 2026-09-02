import { CLOUDINARY_URL_PREFIX } from "@/app/api/products/schema";

/**
 * A product's imageUrl has no DB-level host constraint (Zod-only, at
 * CreateProductSchema) - next/image throws a hard render error for a host
 * outside next.config.mjs's remotePatterns, which would crash the whole
 * page rather than degrade one card (Story 4.2 review finding). Anything
 * that doesn't match this app's own Cloudinary cloud is treated as no
 * image. Single source of truth for this re-validation (Story 8.3 review:
 * this predicate was previously hand-duplicated at every read site).
 */
export function getValidProductImageUrl(imageUrl: string | null): string | null {
  return imageUrl?.startsWith(CLOUDINARY_URL_PREFIX) ? imageUrl : null;
}
