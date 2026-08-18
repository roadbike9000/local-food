-- Story 1.3: drop Product.isAvailable. Availability is computed at read
-- time as `stockQuantity > 0` (architecture AD-2) - no persisted or cached
-- boolean re-derives it under any name. Safe to drop now because
-- stockQuantity was fully backfilled for every existing Product by Story
-- 1.2, before this migration - no window exists where availability is
-- undefined.
ALTER TABLE "Product" DROP COLUMN "isAvailable";
