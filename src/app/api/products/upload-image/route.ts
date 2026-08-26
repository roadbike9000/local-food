/**
 * Image-upload API for the signed-in vendor.
 *
 *   POST   /api/products/upload-image  -> uploads a base64 image to
 *                                          Cloudinary, returns its secure_url
 *   DELETE /api/products/upload-image  -> deletes an orphaned Cloudinary
 *                                          upload (one not referenced by any
 *                                          Product row) - compensating
 *                                          cleanup when POST /api/products
 *                                          fails after the image already
 *                                          uploaded successfully
 *
 * The browser never receives or uses Cloudinary credentials - the upload
 * happens server-side via uploadImage() (src/lib/cloudinary.ts).
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getCurrentVendor, assertVendorActive, VendorDeactivatedError } from "@/lib/vendor";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { UploadImageSchema, DeleteImageSchema } from "./schema";

export async function POST(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // getCurrentVendor() resolves by clerkUserId alone, with no deletedAt
  // filter - a deactivated vendor's own session still resolves here, so
  // this check must be explicit (Epic 2 retro tech debt, same as every
  // other vendor-scoped write route in this codebase).
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

export async function DELETE(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertVendorActive(vendor);
  } catch (err) {
    if (err instanceof VendorDeactivatedError) {
      return NextResponse.json(
        { error: "Your storefront is deactivated." },
        { status: 403 },
      );
    }
    throw err;
  }

  const parsed = DeleteImageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Safety check, not an ownership check: this endpoint has no record of
  // which vendor uploaded which image before a Product row exists, so any
  // authenticated active vendor could otherwise pass in another vendor's
  // live product image and delete it out from under them. Refusing to
  // delete anything a Product row still references makes that impossible
  // regardless of who's asking - this can only ever remove a genuine orphan.
  const inUse = await prisma.product.findFirst({
    where: { imageUrl: parsed.data.imageUrl },
    select: { id: true },
  });
  if (inUse) {
    return NextResponse.json({ error: "Image is in use" }, { status: 400 });
  }

  try {
    await deleteImage(parsed.data.imageUrl);
  } catch (err) {
    // Best-effort cleanup - the caller is already handling its own error
    // (a failed product creation); don't let this secondary failure block it.
    Sentry.captureException(err);
  }

  return NextResponse.json({}, { status: 200 });
}
