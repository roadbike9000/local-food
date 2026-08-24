import { z } from "zod";

// ~3MB raw file / 3,000,000 bytes -> ~4,000,000 base64 characters (1.33x
// inflation) - keeps the worst-case JSON body under Vercel's 4.5MB
// serverless request ceiling (Story 4.1 Dev Notes).
const MAX_BASE64_LENGTH = 4_000_000;

export const UploadImageSchema = z.object({
  image: z
    .string()
    .refine(
      (v) => /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(v),
      "Must be a base64-encoded image",
    )
    .refine(
      (v) => v.length <= MAX_BASE64_LENGTH,
      "Image is too large — max 3MB",
    ),
});
