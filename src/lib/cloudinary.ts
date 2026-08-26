/**
 * Cloudinary helper for product/vendor images.
 *
 * `uploadImage` takes a base64 data URL or a remote URL and returns the hosted
 * secure URL you store on the Product/Vendor record.
 */
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImage(
  fileOrUrl: string,
  folder = "local-food",
): Promise<string> {
  const result = await cloudinary.uploader.upload(fileOrUrl, { folder });
  return result.secure_url;
}

// A Cloudinary secure_url looks like
// https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<name>.<ext>
// — the public_id destroy() needs is "<folder>/<name>" (no version, no
// extension). Derived from the URL rather than stored separately, since
// uploadImage() only ever returns the URL to its callers.
export function extractPublicId(secureUrl: string): string | null {
  const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

/**
 * Deletes a Cloudinary asset by its secure_url. Used to clean up an
 * orphaned upload — one that was uploaded but never got attached to a
 * Product row (e.g. POST /api/products failed after the image upload
 * already succeeded).
 */
export async function deleteImage(secureUrl: string): Promise<void> {
  const publicId = extractPublicId(secureUrl);
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

export { cloudinary };
