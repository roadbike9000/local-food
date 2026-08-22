/**
 * Server-side helper to load the Admin record for the currently signed-in
 * Clerk user. Returns null if the user is not an admin.
 *
 * Import only in server components / route handlers.
 */
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getCurrentAdmin() {
  const { userId } = auth();
  if (!userId) return null;

  return prisma.admin.findUnique({
    where: { clerkUserId: userId },
  });
}

/**
 * Every Admin row with a phone configured (Story 3.2) - low-stock/
 * shortfall SMS alerts fan out to all of them, not just "the" admin.
 * Nothing in this schema enforces exactly one Admin row. Returns an
 * empty array if none are configured - callers must treat that as the
 * expected, normal state, not an error.
 *
 * `phone: { not: null }` doesn't exclude an empty/whitespace-only
 * string (nothing validates `Admin.phone`'s format at write time) - a
 * blank value would otherwise still reach `sendSms()`, which the mock
 * provider records as a successful send (review finding). Trimmed and
 * filtered here. Deduplicated too - nothing prevents two Admin rows
 * sharing one phone, which would otherwise double-send every alert.
 */
export async function getAdminPhoneNumbers(): Promise<string[]> {
  const admins = await prisma.admin.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  });
  const phones = admins
    .map((a) => (a.phone ?? "").trim())
    .filter((p) => p.length > 0);
  return [...new Set(phones)];
}
