import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_LOW_STOCK_THRESHOLD,
  PLACEHOLDER_STOCK_QUANTITY,
} from "./inventory";

// Raw SQL can't import a TS constant (see the migration's own comment), so
// this is the one place AC #2's "never a hardcoded literal" rule is
// necessarily broken. This test is what keeps the two hardcoded literals
// below from silently drifting out of sync with the named constants.
const migrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260818151647_add_stock_quantity_and_threshold/migration.sql",
  ),
  "utf-8",
);

describe("Story 1.2 backfill migration literals", () => {
  it("backfills stockQuantity from isAvailable using PLACEHOLDER_STOCK_QUANTITY's value", () => {
    const match = migrationSql.match(
      /WHEN "isAvailable" THEN (\d+) ELSE \d+ END/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PLACEHOLDER_STOCK_QUANTITY);
  });

  it("backfills lowStockThreshold using PLACEHOLDER_LOW_STOCK_THRESHOLD's value", () => {
    const match = migrationSql.match(/SET "lowStockThreshold" = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PLACEHOLDER_LOW_STOCK_THRESHOLD);
  });
});
