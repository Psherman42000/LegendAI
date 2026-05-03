import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleStyleId } from "./subtitle-styles";
import { SUBTITLE_STYLES } from "./subtitle-styles";

export async function extractAudio(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace(/\.[^.]+$/, ".wav");
  await fs.writeFile(audioPath, Buffer.from("LEGENDAAI_AUDIO_PLACEHOLDER"));
  return audioPath;
}

export async function extractThumbnail(videoPath: string): Promise<string> {
  const thumbnailPath = videoPath.replace(/\.[^.]+$/, ".jpg");
  await fs.writeFile(thumbnailPath, Buffer.from("LEGENDAAI_THUMBNAIL_PLACEHOLDER"));
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
  await fs.writeFile(localPath, Buffer.from(`LEGENDAAI_DOWNLOADED:${url}`));
  return localPath;
}

export async function uploadToR2(filePath: string, key: string): Promise<string> {
  void filePath;
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
