import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleSegment } from "@/types/subtitle";
import { generateSRT } from "@/lib/subtitle-styles";

type RawSegment = { id?: string; start: number; end: number; text: string };

export function normalizeSegmentsForSrt(segments: RawSegment[]): SubtitleSegment[] {
  return segments.map((s, i) => ({
    id: s.id ?? `segment-${i}`,
    start: s.start,
    end: s.end,
    text: s.text,
  }));
}

export async function writeSrtFile(videoId: string, segments: RawSegment[]): Promise<string> {
  const subtitleSegments = normalizeSegmentsForSrt(segments);
  const srt = generateSRT(subtitleSegments);
  const srtPath = path.join(process.cwd(), "tmp", `${videoId}.srt`);
  await fs.mkdir(path.dirname(srtPath), { recursive: true });
  await fs.writeFile(srtPath, srt, "utf8");
  return srtPath;
}
