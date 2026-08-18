-- Story 1.2 review follow-up: distinguish a migration-backfilled Low-Stock
-- Threshold of 0 from a vendor's deliberate choice of 0, so Story 1.6 can
-- flag the former and never the latter.
ALTER TABLE "Product" ADD COLUMN     "thresholdIsPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- Only products that existed before the original stock/threshold migration
-- (20260818151647) went through its value-only backfill. Anything created
-- after that went through the new required-fields creation flow and got a
-- real vendor-chosen value, even if that value happened to be 0 - those
-- rows must stay false.
UPDATE "Product"
SET "thresholdIsPlaceholder" = true
WHERE "createdAt" < TIMESTAMP '2026-08-18 15:16:47';
