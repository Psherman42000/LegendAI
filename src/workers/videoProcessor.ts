import { Worker, type Job } from "bullmq";
import { Prisma, VideoStatus } from "@prisma/client";
import { cleanup, downloadFromR2, extractAudio, extractThumbnail, uploadToR2 } from "@/lib/ffmpeg";
import { correctTranscription } from "@/lib/gpt-correction";
import { prisma } from "@/lib/db";
import { sendVideoReadyEmail } from "@/lib/email";
import { transcribeWithWhisper } from "@/lib/whisper";

interface VideoJob {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
}

const connection = process.env.REDIS_URL
  ? { connection: { url: process.env.REDIS_URL } }
  : undefined;

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
  }).catch(() => undefined);
}

async function saveTranscription(
  videoId: string,
  rawText: string,
  correctedText: string,
  segments: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.transcription.upsert({
    where: { videoId },
    create: {
      videoId,
      rawText,
      correctedText,
      segments,
      language: "pt",
      confidence: 0.92,
    },
    update: {
      rawText,
      correctedText,
      segments,
    },
  });
}

async function processVideo(job: Job<VideoJob>): Promise<void> {
  const { videoId, originalUrl } = job.data;
  await updateVideoStatus(videoId, "PROCESSING");
  await job.updateProgress(5);

  const videoPath = await downloadFromR2(originalUrl);
  await job.updateProgress(15);

  const audioPath = await extractAudio(videoPath);
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
  );
  await job.updateProgress(80);

  const audioUrl = await uploadToR2(audioPath, `audio/${videoId}.wav`);
  await job.updateProgress(85);

  const thumbnailPath = await extractThumbnail(videoPath);
  const thumbnailUrl = await uploadToR2(thumbnailPath, `thumbnails/${videoId}.jpg`);
  await job.updateProgress(90);

  await updateVideoStatus(videoId, "READY", {
    processedAt: new Date(),
    audioUrl,
    thumbnailUrl,
  });

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
  await cleanup([videoPath, audioPath, thumbnailPath]);
}

new Worker<VideoJob>("video-processing", processVideo, connection);
