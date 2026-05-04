import { prisma } from "./db";
import { isR2Configured, getS3Client } from "./r2";

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function checkRedis(): Promise<boolean> {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return false;
    // Lightweight check using installed ioredis dependency
    const { default: Redis } = await import("ioredis");
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

export async function checkR2(): Promise<boolean> {
  try {
    if (!isR2Configured()) return false;
    await getS3Client().send(
      new (await import("@aws-sdk/client-s3")).HeadBucketCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
