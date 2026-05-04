import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Returns true when R2 credentials are configured in the environment. */
export function isR2Configured(): boolean {
  return !!(process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME);
}

/** Lazy S3Client – only created when R2 is actually used. */
let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT ?? "",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return _s3Client;
}

export async function uploadBufferToR2(
  buffer: Uint8Array,
  key: string,
  contentType = "application/octet-stream",
): Promise<string> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await getS3Client().send(command);

  const publicUrl =
    process.env.R2_PUBLIC_URL ?? "https://r2.local";
  return `${publicUrl}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  void key;
}

/**
 * Generate a presigned URL for downloading an object from R2.
 * This allows private buckets to serve files without making them fully public.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: expiresInSeconds });
}

/**
 * Get a presigned public URL for viewing/downloading an R2 object.
 * Shortcut around getSignedDownloadUrl for clearer semantics in API routes.
 */
export async function getPublicUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedDownloadUrl(key, expiresInSeconds);
}

/**
 * Extract the R2 object key from a public URL or return the input if it's already a key.
 */
export function extractR2Key(url: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL ?? "";
  if (publicUrl && url.startsWith(publicUrl)) {
    return url.slice(publicUrl.length + 1); // +1 for the trailing slash
  }
  return url;
}
