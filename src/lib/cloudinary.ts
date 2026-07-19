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

export { cloudinary };
