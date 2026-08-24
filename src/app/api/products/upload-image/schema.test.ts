import { describe, expect, it } from "vitest";
import { MAX_BASE64_LENGTH, UploadImageSchema } from "./schema";

// ATDD scaffolds, Story 4.1 (Task 1) — UploadImageSchema doesn't exist yet.
// Expected red-phase signal: "Cannot find module './schema'" until Task 1
// creates src/app/api/products/upload-image/schema.ts.

// Real 1x1 PNG's base64 payload (tests/fixtures/test-product-image.png,
// decoded inline so this file has no filesystem dependency).
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("UploadImageSchema", () => {
  it("accepts a valid base64-encoded PNG data URL", () => {
    const result = UploadImageSchema.safeParse({
      image: `data:image/png;base64,${VALID_PNG_BASE64}`,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a plain remote URL (not a base64 data URL)", () => {
    const result = UploadImageSchema.safeParse({
      image: "https://example.com/photo.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-data-URL string", () => {
    const result = UploadImageSchema.safeParse({ image: "not an image" });
    expect(result.success).toBe(false);
  });

  it("rejects a data URL with a non-image MIME type", () => {
    const result = UploadImageSchema.safeParse({
      image: "data:text/plain;base64,aGVsbG8=",
    });
    expect(result.success).toBe(false);
  });

  // Story 4.1 review finding — the format check only validated the data-URL
  // prefix, not the payload itself, so an empty payload reached uploadImage()
  // and surfaced as an opaque 502 instead of a clear 400.
  it("rejects a data URL with an empty base64 payload", () => {
    const result = UploadImageSchema.safeParse({
      image: "data:image/png;base64,",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a data URL whose payload contains non-base64 characters", () => {
    const result = UploadImageSchema.safeParse({
      image: "data:image/png;base64,not_valid_base64!!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a base64 payload over the size cap", () => {
    const oversizedBase64 = "A".repeat(MAX_BASE64_LENGTH + 1);
    const result = UploadImageSchema.safeParse({
      image: `data:image/png;base64,${oversizedBase64}`,
    });
    expect(result.success).toBe(false);
  });

  // Story 4.1 review finding — nothing locked in that the format-rejection
  // and size-rejection messages are actually distinct (api-contracts.md and
  // the route's own comments both claim they are, so the form can tell a
  // vendor "too large" apart from "not an image").
  it("gives a distinct message for a format failure vs. a size-cap failure", () => {
    const formatResult = UploadImageSchema.safeParse({ image: "not an image" });
    const sizeResult = UploadImageSchema.safeParse({
      image: `data:image/png;base64,${"A".repeat(MAX_BASE64_LENGTH + 1)}`,
    });

    expect(formatResult.success).toBe(false);
    expect(sizeResult.success).toBe(false);
    if (!formatResult.success && !sizeResult.success) {
      const formatMessage = formatResult.error.issues[0]?.message;
      const sizeMessage = sizeResult.error.issues[0]?.message;
      expect(formatMessage).not.toBe(sizeMessage);
      expect(sizeMessage).toMatch(/too large/i);
    }
  });
});
