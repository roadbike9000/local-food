/**
 * Server-side helper to load the Vendor record for the currently signed-in
 * Clerk user. Returns null if the user has not created a storefront yet.
 *
 * Import only in server components / route handlers.
 */
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getCurrentVendor() {
  const { userId } = auth();
  if (!userId) return null;

  return prisma.vendor.findUnique({
    where: { clerkUserId: userId },
  });
}
