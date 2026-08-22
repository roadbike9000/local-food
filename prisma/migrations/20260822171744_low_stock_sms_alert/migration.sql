-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockAlerted" BOOLEAN NOT NULL DEFAULT false;
