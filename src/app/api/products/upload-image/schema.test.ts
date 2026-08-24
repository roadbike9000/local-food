import { describe, expect, it } from "vitest";
import { UploadImageSchema } from "./schema";

// ATDD scaffolds, Story 4.1 (Task 1) — UploadImageSchema doesn't exist yet.
// Expected red-phase signal: "Cannot find module './schema'" until Task 1
// creates src/app/api/products/upload-image/schema.ts.

// Real 1x1 PNG's base64 payload (tests/fixtures/test-product-image.png,
// decoded inline so this file has no filesystem dependency).
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("UploadImageSchema", () => {
  it.skip("accepts a valid base64-encoded PNG data URL", () => {
    const result = UploadImageSchema.safeParse({
      image: `data:image/png;base64,${VALID_PNG_BASE64}`,
    });
    expect(result.success).toBe(true);
  });

  it.skip("rejects a plain remote URL (not a base64 data URL)", () => {
    const result = UploadImageSchema.safeParse({
      image: "https://example.com/photo.png",
    });
    expect(result.success).toBe(false);
  });

  it.skip("rejects a non-data-URL string", () => {
    const result = UploadImageSchema.safeParse({ image: "not an image" });
    expect(result.success).toBe(false);
  });

  it.skip("rejects a data URL with a non-image MIME type", () => {
    const result = UploadImageSchema.safeParse({
      image: "data:text/plain;base64,aGVsbG8=",
    });
    expect(result.success).toBe(false);
  });

  // ~3MB raw file / 3,000,000 bytes -> ~4,000,000 base64 characters (1.33x
  // inflation) - Dev Notes' documented Vercel body-size cap (Story 4.1).
  it.skip("rejects a base64 payload over the ~4,000,000-character size cap", () => {
    const oversizedBase64 = "A".repeat(4_100_000);
    const result = UploadImageSchema.safeParse({
      image: `data:image/png;base64,${oversizedBase64}`,
    });
    expect(result.success).toBe(false);
  });
});
