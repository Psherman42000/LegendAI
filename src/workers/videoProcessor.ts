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
import { correctTranscription } from "@/lib/gpt-correction";
import { prisma } from "@/lib/db";
import { sendVideoReadyEmail } from "@/lib/email";
import { writeSrtFile } from "@/lib/subtitle-artifacts";
import { transcribeWithWhisper } from "@/lib/whisper";
import type { SubtitleStyleId } from "@/lib/subtitle-styles";

interface VideoJob {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
  subtitleStyle?: SubtitleStyleId;
}

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start video worker");
}

const connection = { connection: { url: process.env.REDIS_URL } };

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
  segments: Prisma.InputJsonValue,
  language: string,
  confidence: number,
): Promise<void> {
  await prisma.transcription.upsert({
    where: { videoId },
    create: {
      videoId,
      rawText,
      correctedText,
      segments,
      language,
      confidence,
    },
    update: {
      rawText,
      correctedText,
      segments,
      language,
      confidence,
    },
  });
}

async function processVideo(job: Job<VideoJob>): Promise<void> {
  const { videoId, originalUrl, subtitleStyle } = job.data;
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
    const correctedSegments = await correctTranscription(rawTranscription.segments);
    await job.updateProgress(70);

    await saveTranscription(
      videoId,
      rawTranscription.rawText,
      correctedSegments.map((segment) => segment.text).join(" "),
      correctedSegments,
      rawTranscription.language,
      rawTranscription.confidence,
    );
    await job.updateProgress(75);

    // Generate SRT from corrected segments
    srtPath = await writeSrtFile(videoId, correctedSegments);
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
      await sendVideoReadyEmail({
        userEmail: video.user.email,
        userName: video.user.name ?? "Usuário",
        videoTitle: video.title,
        videoUrl: `/videos/${videoId}`,
      });
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

const worker = new Worker<VideoJob>("video-processing", processVideo, connection);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
