import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { SubtitleStyleId } from "./subtitle-styles";
import { SUBTITLE_STYLES } from "./subtitle-styles";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT ?? "",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export async function extractAudio(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace(/\.[^.]+$/, ".wav");
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      ["-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "-y", audioPath],
      { timeout: 300_000 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      }
    );
  });
  return audioPath;
}

export async function extractThumbnail(videoPath: string): Promise<string> {
  const thumbnailPath = videoPath.replace(/\.[^.]+$/, ".jpg");
  await new Promise<void>((resolve, reject) => {
    execFile(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      ["-i", videoPath, "-ss", "00:00:01.000", "-vframes", "1", "-y", thumbnailPath],
      { timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      }
    );
  });
  return thumbnailPath;
}

export async function cleanup(files: string[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore cleanup failures for ephemeral worker files.
      }
    }),
  );
}

export async function downloadFromR2(url: string): Promise<string> {
  const filename = path.basename(new URL(url).pathname) || `video-${Date.now()}.mp4`;
  const localPath = path.join(process.cwd(), "tmp", filename);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(localPath, Buffer.from(arrayBuffer));
  
  return localPath;
}

export async function uploadToR2(filePath: string, key: string): Promise<string> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }
  
  const fileContent = await fs.readFile(filePath);
  let contentType = "application/octet-stream";
  if (filePath.endsWith(".mp4")) contentType = "video/mp4";
  else if (filePath.endsWith(".wav")) contentType = "audio/wav";
  else if (filePath.endsWith(".jpg")) contentType = "image/jpeg";
  else if (filePath.endsWith(".srt")) contentType = "text/plain";
  
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  return `${process.env.R2_PUBLIC_URL ?? "https://r2.local"}/${key}`;
}

/**
 * Run FFmpeg to burn subtitles into the video using the specified style.
 * The filter template (style.ffmpegFilter) must contain `FILE` as a placeholder
 * that gets replaced with the escaped SRT path.
 */
export async function applySubtitleStyle(
  videoPath: string,
  srtPath: string,
  styleId: SubtitleStyleId,
  outputPath: string,
): Promise<string> {
  const style = SUBTITLE_STYLES[styleId];
  const escapedSrt = srtPath.replace(/\\/g, "/");
  const filter = style.ffmpegFilter.replace("FILE", escapedSrt);

  await new Promise<void>((resolve, reject) => {
    execFile(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      [
        "-i", videoPath,
        "-vf", filter,
        "-c:a", "copy",
        "-y", outputPath,
      ],
      { timeout: 300_000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve();
        }
      },
    );
  });

  return outputPath;
}
