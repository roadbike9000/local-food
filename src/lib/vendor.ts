/**
 * Server-side helper to load the Vendor record for the currently signed-in
 * Clerk user. Returns null if the user has not created a storefront yet.
 *
 * Import only in server components / route handlers.
 */
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
