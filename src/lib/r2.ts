import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Returns true when R2 credentials are configured in the environment. */
export function isR2Configured(): boolean {
  return !!(process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME);
}

/** Lazy S3Client – only created when R2 is actually used. */
let _s3Client: S3Client | null = null;
export function getS3Client(): S3Client {
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
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  await getS3Client().send(command);
}

/**
 * Generate a presigned URL for downloading an object from R2.
 * This allows private buckets to serve files without making them fully public.
 *
 * @param contentDisposition — if set (e.g. `attachment; filename="video.mp4"`),
 *   R2 will include the Content-Disposition header in the response, forcing download.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  contentDisposition?: string,
): Promise<string> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
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
  const publicUrl = normalizeBaseUrl(process.env.R2_PUBLIC_URL ?? "");
  const trimmed = url.trim();

  if (publicUrl && trimmed.startsWith(`${publicUrl}/`)) {
    return trimmed.slice(publicUrl.length + 1);
  }

  const r2Endpoint = normalizeBaseUrl(process.env.R2_ENDPOINT ?? "");
  if (r2Endpoint && trimmed.startsWith(`${r2Endpoint}/`)) {
    try {
      return extractKeyFromR2Url(new URL(trimmed));
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function extractKeyFromR2Url(url: URL): string {
  const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const bucketName = process.env.R2_BUCKET_NAME ?? "";

  if (bucketName && pathname.startsWith(`${bucketName}/`)) {
    return pathname.slice(bucketName.length + 1);
  }

  return pathname;
}

/**
 * Options for {@link getSignedUrlFromAny}
 */
export type SignedUrlOptions = {
  /** Content-Disposition header value (e.g. `attachment; filename="video.mp4"`) */
  contentDisposition?: string;
};

/**
 * Normalize a stored URL-or-key into a fresh accessible URL.
 *
 * Accepts:
 * - `null` / `undefined` → returns `null`
 * - A public URL (starts with R2_PUBLIC_URL) → extracts key, returns fresh signed URL
 * - A signed URL (contains R2_ENDPOINT)   → extracts key, returns fresh signed URL
 * - An external URL (neither of the above) → returned unchanged
 * - A raw key                             → returns a fresh signed URL
 */
export async function getSignedUrlFromAny(
  urlOrKey?: string | null,
  options?: SignedUrlOptions,
): Promise<string | null> {
  if (!urlOrKey) return null;

  const trimmed = urlOrKey.trim();

  // If it looks like a URL, try to determine if it's an R2 URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const key = extractR2Key(trimmed);

    // Public/signed R2 URLs are converted into fresh signed URLs.
    if (key !== trimmed) {
      return getSignedDownloadUrl(key, 3600, options?.contentDisposition);
    }

    // External (non-R2) URL — return unchanged
    return trimmed;
  }

  // Raw key — generate a fresh signed URL
  return getSignedDownloadUrl(trimmed, 3600, options?.contentDisposition);
}
