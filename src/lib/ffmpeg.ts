import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { SubtitleStyleId } from "./subtitle-styles";
import { SUBTITLE_STYLES } from "./subtitle-styles";
import { uploadBufferToR2 } from "./r2";

// ─────────────────────────────────────────────
// FFmpeg binary resolution
// ─────────────────────────────────────────────
function findFfmpegExecutable(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const candidates = [
    "ffmpeg",
    path.join("C:", "tools", "ffmpeg", "ffmpeg-8.1-essentials_build", "bin", "ffmpeg.exe"),
    path.join(os.homedir(), "scoop", "apps", "ffmpeg", "current", "bin", "ffmpeg.exe"),
    path.join(os.homedir(), "AppData", "Local", "Microsoft", "WinGet", "Packages", "ffmpeg.exe"),
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return "ffmpeg";
}

function ffmpeg(args: string[], timeout = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(findFfmpegExecutable(), args, { timeout }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
}

function uniqueSiblingPath(sourcePath: string, extension: string): string {
  const parsed = path.parse(sourcePath);
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return path.join(parsed.dir, `${parsed.name}-${Date.now()}-${randomUUID()}${normalizedExtension}`);
}

export function buildExtractAudioCommand(videoPath: string): { audioPath: string; args: string[] } {
  const audioPath = uniqueSiblingPath(videoPath, ".wav");
  return {
    audioPath,
    args: [
      "-y",
      "-nostdin",
      "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      audioPath,
    ],
  };
}

function buildExtractThumbnailCommand(videoPath: string): { thumbnailPath: string; args: string[] } {
  const thumbnailPath = uniqueSiblingPath(videoPath, ".jpg");
  return {
    thumbnailPath,
    args: [
      "-y",
      "-nostdin",
      "-i", videoPath,
      "-ss", "00:00:01",
      "-vframes", "1",
      thumbnailPath,
    ],
  };
}

// ─────────────────────────────────────────────
// Audio extraction
// ─────────────────────────────────────────────
export async function extractAudio(videoPath: string): Promise<string> {
  const { audioPath, args } = buildExtractAudioCommand(videoPath);
  await ffmpeg(args);
  return audioPath;
}

// ─────────────────────────────────────────────
// Thumbnail extraction
// ─────────────────────────────────────────────
export async function extractThumbnail(videoPath: string): Promise<string> {
  const { thumbnailPath, args } = buildExtractThumbnailCommand(videoPath);
  await ffmpeg(args);
  return thumbnailPath;
}

// ─────────────────────────────────────────────
// File cleanup
// ─────────────────────────────────────────────
export async function cleanup(files: string[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try { await fs.unlink(file); } catch { /* ignore ephemeral file errors */ }
    }),
  );
}

// ─────────────────────────────────────────────
// Download from R2 (public URL)
// ─────────────────────────────────────────────
export async function downloadFromR2(url: string): Promise<string> {
  const filename = path.basename(new URL(url).pathname) || `video-${Date.now()}.mp4`;
  const localPath = path.join(process.cwd(), "tmp", filename);
  await fs.mkdir(path.dirname(localPath), { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar do R2: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);
  return localPath;
}

// ─────────────────────────────────────────────
// Upload to R2 from local file
// ─────────────────────────────────────────────
export async function uploadToR2(filePath: string, key: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath);
  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".jpg": "image/jpeg",
    ".srt": "application/x-subrip",
    ".vtt": "text/vtt",
  };
  return uploadBufferToR2(new Uint8Array(buffer), key, mimeMap[ext] ?? "application/octet-stream");
}

// ─────────────────────────────────────────────
// Burn subtitles into video
// ─────────────────────────────────────────────
export async function applySubtitleStyle(
  videoPath: string,
  srtPath: string,
  styleId: SubtitleStyleId,
  outputPath: string,
): Promise<string> {
  const style = SUBTITLE_STYLES[styleId];

  // Escape the SRT path for ffmpeg subtitles filter
  // Windows paths need escaping: backslashes → forward slashes, colons → \:
  const escapedSrt = srtPath
    .replace(/\\/g, "/")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:");

  // Build the filter string from the style's ffmpegFilter template
  // Template format: "subtitles=FILE:force_style='...'" where FILE is the placeholder
  const forceStyle = style.ffmpegFilter.split(":")[1];
  const filter = `subtitles='${escapedSrt}':${forceStyle}`;

  await ffmpeg([
    "-y",
    "-nostdin",
    "-i", videoPath,
    "-vf", filter,
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);

  return outputPath;
}
