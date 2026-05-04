import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleSegment } from "@/types/subtitle";
import { generateSRT } from "@/lib/subtitle-styles";

type RawSegment = { id?: string; start: number; end: number; text: string };

/** Replace non-alphanumeric characters with underscores to prevent path traversal / injection */
function sanitizeVideoId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Validate a segment has finite times and end > start.
 * Throws on invalid input to fail fast rather than produce malformed SRT.
 */
function validateSegment(s: RawSegment, index: number): void {
  if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) {
    throw new Error(
      `Segment ${index} has non-finite times: start=${s.start}, end=${s.end}`,
    );
  }
  if (s.end <= s.start) {
    throw new Error(
      `Segment ${index} end (${s.end}) is not greater than start (${s.start})`,
    );
  }
}

export function normalizeSegmentsForSrt(segments: RawSegment[]): SubtitleSegment[] {
  return segments.map((s, i) => {
    validateSegment(s, i);
    return {
      id: s.id ?? `segment-${i}`,
      start: s.start,
      end: s.end,
      text: s.text,
    };
  });
}

export async function writeSrtFile(videoId: string, segments: RawSegment[]): Promise<string> {
  const sanitized = sanitizeVideoId(videoId);
  const subtitleSegments = normalizeSegmentsForSrt(segments);
  const srt = generateSRT(subtitleSegments);
  const srtPath = path.join(process.cwd(), "tmp", `${sanitized}.srt`);
  await fs.mkdir(path.dirname(srtPath), { recursive: true });
  await fs.writeFile(srtPath, srt, "utf8");
  return srtPath;
}
