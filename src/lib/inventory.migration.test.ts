import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PLACEHOLDER_LOW_STOCK_THRESHOLD,
  PLACEHOLDER_STOCK_QUANTITY,
} from "./availability";

// Raw SQL can't import a TS constant (see the migration's own comment), so
// this is the one place AC #2's "never a hardcoded literal" rule is
// necessarily broken. This test is what keeps the hardcoded literals below
// from silently drifting out of sync with the named constants.
let migrationSql: string;

describe("Story 1.2 backfill migration literals", () => {
  beforeAll(() => {
    // Read inside a hook (not at module top level) so a missing/renamed
    // file fails these tests normally instead of aborting collection of
    // this whole file (review round 2, finding P8).
    migrationSql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260818151647_add_stock_quantity_and_threshold/migration.sql",
      ),
      "utf-8",
    );
  });

  it("backfills stockQuantity from isAvailable:true using PLACEHOLDER_STOCK_QUANTITY's value", () => {
    const match = migrationSql.match(
      /WHEN "isAvailable" THEN (\d+) ELSE (\d+) END/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PLACEHOLDER_STOCK_QUANTITY);
  });

  it("backfills stockQuantity from isAvailable:false to the fixed value 0", () => {
    // Unlike the THEN branch, this ELSE isn't a placeholder sentinel - a
    // product already marked unavailable really has 0 stock, so there's no
    // PLACEHOLDER_* constant for it to track. Still asserted explicitly so
    // it can't silently drift to a different integer (round 2, finding P8
    // noted the original version of this test only checked the THEN half).
    const match = migrationSql.match(
      /WHEN "isAvailable" THEN (\d+) ELSE (\d+) END/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![2])).toBe(0);
  });

  it("backfills lowStockThreshold using PLACEHOLDER_LOW_STOCK_THRESHOLD's value", () => {
    const match = migrationSql.match(/SET "lowStockThreshold" = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PLACEHOLDER_LOW_STOCK_THRESHOLD);
  });
});
