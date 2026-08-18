-- Story 1.2: add Product.stockQuantity and Product.lowStockThreshold.
-- Two-step (nullable -> backfill -> NOT NULL) because both are required
-- columns on a non-empty table with no meaningful universal default.

-- Step 1: add both columns as nullable.
ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER;
ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER;

-- Step 2: backfill existing rows.
-- These literals (100, 0) must stay in sync with PLACEHOLDER_STOCK_QUANTITY
-- and PLACEHOLDER_LOW_STOCK_THRESHOLD in src/lib/inventory.ts - raw SQL
-- can't import a TS constant, so this comment is what prevents drift.
UPDATE "Product" SET "stockQuantity" = CASE WHEN "isAvailable" THEN 100 ELSE 0 END;
UPDATE "Product" SET "lowStockThreshold" = 0;

-- Step 3: now safe to enforce NOT NULL.
ALTER TABLE "Product" ALTER COLUMN "stockQuantity" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "lowStockThreshold" SET NOT NULL;
