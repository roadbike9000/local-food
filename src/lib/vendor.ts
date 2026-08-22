/**
 * Server-side helper to load the Vendor record for the currently signed-in
 * Clerk user. Returns null if the user has not created a storefront yet.
 *
 * Import only in server components / route handlers.
 */
import type { Vendor } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function getCurrentVendor() {
  const { userId } = auth();
  if (!userId) return null;

  return prisma.vendor.findUnique({
    where: { clerkUserId: userId },
  });
}

/**
 * Normalizes a desired slug and checks it against existing Vendor rows,
 * returning a friendly error instead of letting a raw Prisma unique-
 * constraint failure reach the caller (architecture AD-7). Admin-create
 * path only - not a throwing function, since a slug collision is an
 * expected, common validation outcome, not an unexpected failure.
 */
export async function resolveVendorSlug(
  desiredSlug: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const slug = slugify(desiredSlug);

  // slugify() strips every non-alphanumeric character - a punctuation-only
  // or whitespace-only input (e.g. "!!!") normalizes to "", which would
  // otherwise pass Zod's min(1) (checked pre-normalization) and create a
  // Vendor with an unreachable storefront (/vendors/ matches no route).
  if (!slug) {
    return {
      ok: false,
      error: "That slug contains no usable characters — try letters, numbers, or hyphens.",
    };
  }

  const existing = await prisma.vendor.findUnique({ where: { slug } });
  if (existing) {
    return {
      ok: false,
      error: `The slug "${slug}" is already in use — try a different one.`,
    };
  }

  return { ok: true, slug };
}

/**
 * Typed error thrown by assertVendorActive() (architecture AD-4) - lets
 * callers instanceof-check specifically for "vendor is deactivated" rather
 * than catching any error and guessing what it means.
 */
export class VendorDeactivatedError extends Error {}

/**
 * The sole check for "is this vendor still active" (AD-4) - throws, never
 * returns a boolean, so every call site is forced through the same
 * try/catch shape rather than each reimplementing the `deletedAt` check
 * inline. Storefront (Story 2.3) catches it and renders a message;
 * checkout catches it and returns its existing 4xx error-JSON shape.
 */
export function assertVendorActive(vendor: Vendor): void {
  if (vendor.deletedAt) {
    throw new VendorDeactivatedError(`Vendor ${vendor.id} is deactivated.`);
  }
}
