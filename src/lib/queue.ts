import { Queue } from "bullmq";

export type VideoJobPayload = {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
};

let videoQueue: Queue<VideoJobPayload> | null = null;

function getVideoQueue(): Queue<VideoJobPayload> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to enqueue video jobs");
  }

  if (!videoQueue) {
    videoQueue = new Queue<VideoJobPayload>("video-processing", {
      connection: { url: redisUrl },
    });
  }

  return videoQueue;
}

export async function enqueueVideoJob(data: VideoJobPayload): Promise<void> {
  const queue = getVideoQueue();

  await queue.add("process-video", data, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    delay: 0,
  });
}
