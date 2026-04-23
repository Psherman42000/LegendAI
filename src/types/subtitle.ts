import type { SubtitleStyleId } from "@/lib/subtitle-styles";

export type SubtitleSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
};

export type SubtitleStyle = SubtitleStyleId;
export type TranscriptionSegment = SubtitleSegment;
