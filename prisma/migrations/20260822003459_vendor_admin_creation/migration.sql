-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "createdByAdminId" TEXT,
ALTER COLUMN "clerkUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
