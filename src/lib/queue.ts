import { Queue } from "bullmq";

export type VideoJobPayload = {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
  useAiCorrection?: boolean;
};

let videoQueue: Queue<VideoJobPayload> | null = null;

function getVideoQueue(): Queue<VideoJobPayload> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to enqueue video jobs");
  }

  if (!videoQueue) {
    videoQueue = new Queue<VideoJobPayload>("video-processing", {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    });

    process.on("SIGTERM", async () => {
      if (videoQueue) await videoQueue.close();
    });

    process.on("SIGINT", async () => {
      if (videoQueue) await videoQueue.close();
    });
  }

  return videoQueue;
}

export async function enqueueVideoJob(data: VideoJobPayload): Promise<void> {
  const queue = getVideoQueue();
  await queue.add("process-video", data);

  // Best-effort trigger of the on-demand worker — cron is the backup
  triggerWorker().catch(() => undefined);
}

/**
 * Trigger the on-demand worker to start processing jobs.
 * This sends a lightweight HTTP request to the worker start URL.
 * If no URL is configured, it silently does nothing (cron will catch it).
 */
export async function triggerWorker(): Promise<void> {
  const workerStartUrl = process.env.WORKER_START_URL;
  if (!workerStartUrl) return;

  try {
    await fetch(workerStartUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.WORKER_SECRET ?? "" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail — cron backup will handle it
  }
}
