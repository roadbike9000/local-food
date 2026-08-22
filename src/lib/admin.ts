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
 */
export async function getAdminPhoneNumbers(): Promise<string[]> {
  const admins = await prisma.admin.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  });
  return admins.map((a) => a.phone as string);
}
