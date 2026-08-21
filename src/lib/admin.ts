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
