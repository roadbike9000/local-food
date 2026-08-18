-- Story 1.2 review follow-up: distinguish a migration-backfilled Low-Stock
-- Threshold of 0 (and Stock Quantity of 100) from a vendor's deliberate
-- choice of the same value, so Story 1.6 can flag the former and never
-- the latter.
ALTER TABLE "Product" ADD COLUMN     "thresholdIsPlaceholder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN     "stockIsPlaceholder" BOOLEAN NOT NULL DEFAULT false;

-- Guarded in a DO block for three reasons (review round 3, M2/M3/M4):
--   1. `prisma migrate dev`'s shadow database re-executes every migration
--      script from scratch and never creates _prisma_migrations - that
--      table only exists on a real, persisted database. Without the
--      to_regclass guard, this block would fail shadow-DB validation and
--      block every future `prisma migrate dev` run in this repo.
--   2. MAX(...) + "finished_at" IS NOT NULL guards against zero or
--      multiple rows for migration 1's name (e.g. a failed-then-reapplied
--      migration) - a bare scalar subquery would either error on >1 row
--      or silently backfill nothing on 0 rows.
--   3. AT TIME ZONE 'UTC' converts the timestamptz apply-time into the
--      same UTC wall-clock representation Product.createdAt is stored in
--      (a timestamp without time zone) - a bare comparison would instead
--      cast implicitly through the current session's TimeZone setting,
--      which is UTC on Neon today but isn't guaranteed everywhere.
DO $$
DECLARE
  cutoff TIMESTAMP;
BEGIN
  IF to_regclass('"_prisma_migrations"') IS NULL THEN
    RETURN;
  END IF;

  SELECT MAX("finished_at") AT TIME ZONE 'UTC' INTO cutoff
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260818151647_add_stock_quantity_and_threshold'
    AND "finished_at" IS NOT NULL;

  IF cutoff IS NULL THEN
    RETURN;
  END IF;

  -- Only products that existed before migration 1's real apply time went
  -- through its value-only backfill. Anything created after that went
  -- through the required-fields creation flow and got real vendor-chosen
  -- values, even if one happened to equal the placeholder - those rows
  -- must stay false.
  UPDATE "Product"
  SET "thresholdIsPlaceholder" = true, "stockIsPlaceholder" = true
  WHERE "createdAt" < cutoff;
END $$;
