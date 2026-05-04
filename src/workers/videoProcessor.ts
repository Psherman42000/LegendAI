import path from "node:path";
import { Worker, type Job } from "bullmq";
import { Prisma, VideoStatus } from "@prisma/client";
import {
  cleanup,
  downloadFromR2,
  extractAudio,
  extractThumbnail,
  uploadToR2,
  applySubtitleStyle,
} from "@/lib/ffmpeg";
import { correctTranscription } from "@/lib/correction";
import { prisma } from "@/lib/db";
import { sendVideoReadyEmail } from "@/lib/email";
import { writeSrtFile } from "@/lib/subtitle-artifacts";
import { transcribeWithWhisper } from "@/lib/whisper";
import { splitSegmentsByWords, type WordLevelSegment } from "@/lib/segment-splitter";
import type { SubtitleStyleId } from "@/lib/subtitle-styles";

interface VideoJob {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
  subtitleStyle?: SubtitleStyleId;
  useAiCorrection?: boolean;
}

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required to start video worker");
  }
  return url;
}

const workerOptions = { connection: { url: getRedisUrl() } };

async function updateVideoStatus(
  videoId: string,
  status: VideoStatus,
  extra: Prisma.VideoUpdateInput = {},
): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status,
      ...extra,
    },
  });
}

async function saveTranscription(
  videoId: string,
  rawText: string,
  correctedText: string,
  segments: WordLevelSegment[],
  language: string,
  confidence: number,
): Promise<void> {
  await prisma.transcription.upsert({
    where: { videoId },
    create: {
      videoId,
      rawText,
      correctedText,
      segments: segments as unknown as Prisma.InputJsonValue,
      language,
      confidence,
    },
    update: {
      rawText,
      correctedText,
      segments: segments as unknown as Prisma.InputJsonValue,
      language,
      confidence,
    },
  });
}

async function processVideo(job: Job<VideoJob>): Promise<void> {
  const { videoId, originalUrl, subtitleStyle, useAiCorrection } = job.data;
  let videoPath = "";
  let audioPath = "";
  let thumbnailPath = "";
  let srtPath = "";
  let outputPath = "";

  try {
    await updateVideoStatus(videoId, "PROCESSING");
    await job.updateProgress(5);

    videoPath = await downloadFromR2(originalUrl);
    await job.updateProgress(15);

    audioPath = await extractAudio(videoPath);
    await updateVideoStatus(videoId, "TRANSCRIBING");
    await job.updateProgress(25);

    const rawTranscription = await transcribeWithWhisper(audioPath);
    await job.updateProgress(55);

    await updateVideoStatus(videoId, "CORRECTING");
    const correctedSegments = await correctTranscription(rawTranscription.segments, useAiCorrection);
    await job.updateProgress(70);

    const correctedSegmentsWithWords = correctedSegments.map((segment, index) => ({
      ...segment,
      words: segment.words ?? rawTranscription.segments[index]?.words,
    }));

    // Build word-level segments for precise subtitle display
    const wordLevelSegments = splitSegmentsByWords(correctedSegmentsWithWords, {
      maxWordsPerChunk: 3,
      minDurationSeconds: 0.8,
      maxDurationSeconds: 2.5,
    });

    await saveTranscription(
      videoId,
      rawTranscription.rawText,
      wordLevelSegments.map((segment) => segment.text).join(" "),
      wordLevelSegments,
      rawTranscription.language,
      rawTranscription.confidence,
    );
    await job.updateProgress(75);

    // Generate SRT from word-level segments
    srtPath = await writeSrtFile(videoId, wordLevelSegments);
    await job.updateProgress(78);

    // Burn subtitles into video
    await updateVideoStatus(videoId, "BURNING");
    outputPath = path.join(process.cwd(), "tmp", `${videoId}-subtitled.mp4`);
    await applySubtitleStyle(videoPath, srtPath, subtitleStyle ?? "classic", outputPath);
    await job.updateProgress(85);

    // Upload all outputs
    await updateVideoStatus(videoId, "UPLOADING_OUTPUTS");

    const audioUrl = await uploadToR2(audioPath, `audio/${videoId}.wav`);
    await job.updateProgress(87);

    thumbnailPath = await extractThumbnail(videoPath);
    const thumbnailUrl = await uploadToR2(thumbnailPath, `thumbnails/${videoId}.jpg`);
    await job.updateProgress(90);

    const processedUrl = await uploadToR2(outputPath, `videos/${videoId}/final.mp4`);
    await job.updateProgress(93);

    const srtUrl = await uploadToR2(srtPath, `videos/${videoId}/subtitles.srt`);
    await job.updateProgress(96);

    // Mark ready only when both artifacts exist
    await updateVideoStatus(videoId, "READY", {
      processedAt: new Date(),
      processedUrl,
      srtUrl,
      audioUrl,
      thumbnailUrl,
      errorMessage: null,
    });
    await job.updateProgress(98);

    const video = await prisma.video.findUnique({ where: { id: videoId }, include: { user: true } });
    if (video?.user.email) {
      try {
        await sendVideoReadyEmail({
          userEmail: video.user.email,
          userName: video.user.name ?? "Usuário",
          videoTitle: video.title,
          videoUrl: `/videos/${videoId}`,
        });
      } catch (emailError) {
        // Log email errors but do not fail video processing
        console.error(`[Worker] Failed to send video-ready email for ${videoId}:`, emailError);
      }
    }

    await job.updateProgress(100);
  } catch (error) {
    await prisma.video
      .update({
        where: { id: videoId },
        data: {
          status: "ERROR",
          errorMessage: error instanceof Error ? error.message : "Unknown worker error",
        },
      })
      .catch(() => undefined);
    throw error;
  } finally {
    try {
      await cleanup([videoPath, audioPath, thumbnailPath, srtPath, outputPath].filter(Boolean));
    } catch {
      // Ignore cleanup errors to avoid masking job failures
    }
  }
}

/**
 * Create and start the video processing worker.
 *
 * Can be called programmatically (e.g. from start-worker.ts) or
 * triggered automatically when this module is the entry point.
 *
 * Sets up idle shutdown and graceful signal handling internally.
 */
export async function runWorker(): Promise<void> {
  const WORKER_IDLE_TIMEOUT_MS = Number(
    process.env.WORKER_IDLE_TIMEOUT_MS ?? 60_000,
  );

  const w = new Worker<VideoJob>("video-processing", processVideo, workerOptions);

  // ── Idle shutdown ────────────────────────────────────────
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let activeJobs = 0;

  function resetIdleTimer(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
    }
    if (activeJobs <= 0) {
      idleTimer = setTimeout(async () => {
        console.log(`[Worker] No jobs for ${WORKER_IDLE_TIMEOUT_MS}ms — shutting down`);
        await w.close();
        process.exit(0);
      }, WORKER_IDLE_TIMEOUT_MS);
    }
  }

  w.on("active", () => {
    activeJobs++;
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });

  w.on("completed", () => {
    activeJobs = Math.max(0, activeJobs - 1);
    resetIdleTimer();
  });

  w.on("failed", () => {
    activeJobs = Math.max(0, activeJobs - 1);
    resetIdleTimer();
  });

  w.on("error", (err) => {
    console.error("[Worker] Error:", err);
  });

  // Start idle timer on launch
  resetIdleTimer();

  // ── Graceful shutdown ────────────────────────────────────
  const handleSignal = async (signal: string): Promise<void> => {
    console.log(`[Worker] ${signal} received — closing`);
    if (idleTimer !== null) clearTimeout(idleTimer);
    await w.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void handleSignal("SIGTERM"));
  process.on("SIGINT", () => void handleSignal("SIGINT"));
}

// ── Auto-start when run directly ──────────────────────────
const isMainModule = process.argv[1]?.replace(/\\/g, "/").endsWith("videoProcessor.ts");

if (isMainModule) {
  runWorker().catch((err) => {
    console.error("[Worker] Failed to start:", err);
    process.exit(1);
  });
}
