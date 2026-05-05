/**
 * Worker start script.
 *
 * Checks BullMQ's `video-processing` queue for pending work before spawning
 * the video processor worker as a child process. Exits immediately if no
 * work is pending or if a worker is already active (deduplication).
 *
 * On non-zero exit, respawns the worker up to MAX_RESTART_ATTEMPTS times
 * if jobs still remain in the queue.
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
const MAX_RESTART_ATTEMPTS = 3;

async function main(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  let restartCount = 0;

  async function spawnWorker(): Promise<void> {
    const counts = await queue.getJobCounts(
      "waiting",
      "delayed",
      "prioritized",
      "active",
      "failed",
    );

    const pending =
      (counts.waiting ?? 0) +
      (counts.delayed ?? 0) +
      (counts.prioritized ?? 0);
    const active = counts.active ?? 0;

    if (pending === 0) {
      console.log(`[start-worker] No pending jobs in "${QUEUE_NAME}" — exiting`);
      await queue.close();
      return;
    }

    // Deduplication: if a worker is already actively processing, skip spawn
    if (active > 0) {
      console.log(
        `[start-worker] Worker already active (${active} job(s) in progress) — skipping spawn`,
      );
      await queue.close();
      return;
    }

    console.log(`[start-worker] ${pending} pending job(s) found — spawning worker`);

    const workerScript = path.join(
      process.cwd(),
      "src",
      "workers",
      "videoProcessor.ts",
    );

    const child = spawn("npx", ["tsx", workerScript], {
      stdio: "inherit",
      env: { ...process.env },
      detached: true,
    });

    child.on("exit", async (code) => {
      // Auto-restart on crash if jobs remain and we haven't exhausted retries
      if (code !== 0 && code !== null && restartCount < MAX_RESTART_ATTEMPTS) {
        const remaining = await queue.getJobCounts(
          "waiting",
          "delayed",
          "prioritized",
          "failed",
        );
        const stillPending =
          (remaining.waiting ?? 0) +
          (remaining.delayed ?? 0) +
          (remaining.prioritized ?? 0) +
          (remaining.failed ?? 0);

        if (stillPending > 0) {
          restartCount++;
          console.log(
            `[start-worker] Worker exited with code ${code}, ${stillPending} job(s) remaining — restarting (${restartCount}/${MAX_RESTART_ATTEMPTS})`,
          );
          spawnWorker(); // Recurse to restart
          return;
        }
      }

      await queue.close();
      process.exit(code ?? 0);
    });

    child.on("error", async (err) => {
      console.error("[start-worker] Failed to spawn worker:", err);
      await queue.close();
      process.exit(1);
    });
  }

  await spawnWorker();
}

main().catch((err: unknown) => {
  console.error("[start-worker] Fatal error:", err);
  process.exit(1);
});
