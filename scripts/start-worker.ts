/**
 * Worker start script.
 *
 * Checks BullMQ's `video-processing` queue for pending work before spawning
 * the video processor worker as a child process. Exits immediately if no
 * work is pending.
 *
 * Usage: npx tsx --env-file=.env.local scripts/start-worker.ts
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error("[start-worker] REDIS_URL is required");
  process.exit(1);
}

const QUEUE_NAME = "video-processing";

async function main(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  try {
    const counts = await queue.getJobCounts("waiting", "delayed", "prioritized");
    const pending =
      (counts.waiting ?? 0) +
      (counts.delayed ?? 0) +
      (counts.prioritized ?? 0);

    if (pending === 0) {
      console.log(`[start-worker] No pending jobs in "${QUEUE_NAME}" — exiting`);
      return;
    }

    console.log(`[start-worker] ${pending} pending job(s) found — spawning worker`);
  } finally {
    await queue.close();
  }

  // Spawn the worker using npx tsx as the runner (matches existing npm script pattern)
  const workerScript = path.join(process.cwd(), "src", "workers", "videoProcessor.ts");

  const child = spawn(
    "npx",
    ["tsx", workerScript],
    {
      stdio: "inherit",
      env: { ...process.env },
      detached: true,
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    console.error("[start-worker] Failed to spawn worker:", err);
    process.exit(1);
  });
}

main().catch((err: unknown) => {
  console.error("[start-worker] Fatal error:", err);
  process.exit(1);
});
