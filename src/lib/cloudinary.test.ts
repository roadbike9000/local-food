import { describe, expect, it } from "vitest";
import { extractPublicId } from "./cloudinary";

describe("extractPublicId", () => {
  it("extracts the folder/name public_id from a versioned secure_url", () => {
    expect(
      extractPublicId(
        "https://res.cloudinary.com/demo/image/upload/v1699999999/local-food/abc123.jpg",
      ),
    ).toBe("local-food/abc123");
  });

  it("extracts the public_id when no version segment is present", () => {
    expect(
      extractPublicId("https://res.cloudinary.com/demo/image/upload/local-food/abc123.png"),
    ).toBe("local-food/abc123");
  });

  it("returns null for a URL that isn't a Cloudinary upload URL", () => {
    expect(extractPublicId("https://example.com/not-cloudinary.jpg")).toBeNull();
  });
});
