/**
 * Image-upload API for the signed-in vendor.
 *
 *   POST /api/products/upload-image  -> uploads a base64 image to Cloudinary,
 *                                        returns its secure_url
 *
 * The browser never receives or uses Cloudinary credentials - the upload
 * happens server-side via uploadImage() (src/lib/cloudinary.ts).
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getCurrentVendor, assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { uploadImage } from "@/lib/cloudinary";
import { UploadImageSchema } from "./schema";

export async function POST(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return NextResponse.json(
        { error: "Your storefront is deactivated — you can no longer add products." },
        { status: 403 },
      );
    }
    throw err;
  }

  const parsed = UploadImageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Surface the schema's own message (format vs. size-cap are two
    // distinct .refine() failures with distinct wording) rather than a
    // single generic "Invalid request" - the form needs to tell a vendor
    // "too large" apart from "not an image".
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const imageUrl = await uploadImage(parsed.data.image);
    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Could not upload image. Try again." },
      { status: 502 },
    );
  }
}
