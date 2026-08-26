import { z } from "zod";

// Single source of truth for the raw-file cap, imported by AddProductForm.tsx
// for its client-side check too (Story 4.1 review finding: the two caps had
// drifted - the client compared raw bytes against 3 * 1024 * 1024 while this
// schema compared the base64 *string* against a separately-chosen 4,000,000,
// which back-converts to slightly under 3MB raw, not 3MiB - a ~140KB band of
// files passed the client check and then failed the server one).
export const MAX_IMAGE_RAW_BYTES = 3 * 1024 * 1024;

// Exact base64 length for MAX_IMAGE_RAW_BYTES (ceil(bytes/3)*4), plus a small
// fixed buffer for the "data:image/...;base64," prefix - still safely under
// Vercel's 4.5MB serverless request ceiling (Story 4.1 Dev Notes). Exported
// so tests can derive an over-the-cap value instead of hardcoding one that
// can silently drift out of sync with this constant.
export const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_RAW_BYTES / 3) * 4 + 50;

const DATA_URL_PREFIX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/;

// Validates the base64 payload itself (empty/malformed content, not just
// the data-URL prefix - Story 4.1 review finding), without a regex
// quantifier run against the whole (up to multi-megabyte) payload: a regex
// like /^[A-Za-z0-9+/]+={0,2}$/ tested against a ~4MB string reproducibly
// threw "RangeError: Maximum call stack size exceeded" under load (V8's
// backtracking engine recursing on a long greedy match). A plain
// character-by-character loop has no such recursion risk.
function hasValidBase64Payload(v: string): boolean {
  const match = v.match(DATA_URL_PREFIX);
  if (!match) return false;

  const payload = v.slice(match[0].length);
  if (payload.length === 0) return false;

  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    const isBase64Char =
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) || // a-z
      code === 43 || // +
      code === 47; // /
    if (isBase64Char) continue;
    if (code === 61) {
      // '=' is only valid as padding in the final one or two characters.
      return i >= payload.length - 2;
    }
    return false;
  }
  return true;
}

export const UploadImageSchema = z.object({
  image: z
    .string()
    .refine(hasValidBase64Payload, "Must be a base64-encoded image")
    .refine(
      (v) => v.length <= MAX_BASE64_LENGTH,
      "Image is too large — max 3MB",
    ),
});

export const DeleteImageSchema = z.object({
  imageUrl: z.string().url(),
});
