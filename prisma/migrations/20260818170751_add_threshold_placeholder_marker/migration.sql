-- Story 1.2 review follow-up: distinguish a migration-backfilled Low-Stock
-- Threshold of 0 (and Stock Quantity of 100) from a vendor's deliberate
-- choice of the same value, so Story 1.6 can flag the former and never
-- the latter.
ALTER TABLE "Product" ADD COLUMN     "thresholdIsPlaceholder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN     "stockIsPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- Only products that existed before the original stock/threshold migration
-- (20260818151647) went through its value-only backfill. Anything created
-- after that went through the new required-fields creation flow and got
-- real vendor-chosen values, even if one happened to equal the placeholder
-- - those rows must stay false.
--
-- Keyed off that migration's actual applied time (_prisma_migrations.finished_at),
-- not this file's own authoring timestamp - migration 1 may apply at a very
-- different moment on any environment other than the one these two
-- migrations were authored back-to-back on (review round 2, finding D1).
UPDATE "Product"
SET "thresholdIsPlaceholder" = true, "stockIsPlaceholder" = true
WHERE "createdAt" < (
  SELECT "finished_at" FROM "_prisma_migrations"
  WHERE "migration_name" = '20260818151647_add_stock_quantity_and_threshold'
);
