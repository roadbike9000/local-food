/**
 * A single shared PrismaClient instance.
 *
 * Why the global trick: in development Next.js reloads modules on every change.
 * Without caching the client on `globalThis`, each reload would open a new
 * database connection and you would quickly exhaust the connection pool.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
