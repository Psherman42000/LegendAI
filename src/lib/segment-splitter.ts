import type { TranscriptionSegment } from "@/types/subtitle";

export interface SplitSegmentsOptions {
  /** Maximum number of words per chunk (default: 3) */
  maxWordsPerChunk?: number;
  /** Minimum duration in seconds for each chunk (default: 0.8) */
  minDurationSeconds?: number;
  /** Maximum duration in seconds for each chunk (default: 3.0) */
  maxDurationSeconds?: number;
}

export interface WordLevelSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}

/**
 * Split transcription segments into smaller word-level chunks suitable for
 * subtitle display.
 *
 * Each original segment may contain word-level timestamps. When available,
 * words are grouped into chunks respecting the configured word count and
 * duration constraints. When word timestamps are missing, the segment text
 * is split heuristically and timestamps are interpolated.
 *
 * @param segments - Array of transcription segments from Whisper.
 * @param options  - Splitting constraints.
 * @returns Word-level segments ready for SRT/VTT generation.
 */
export function splitSegmentsByWords(
  segments: TranscriptionSegment[],
  options: SplitSegmentsOptions = {},
): WordLevelSegment[] {
  const {
    maxWordsPerChunk = 3,
    minDurationSeconds = 0.8,
    maxDurationSeconds = 3.0,
  } = options;

  const result: WordLevelSegment[] = [];
  let segmentIndex = 0;

  for (const segment of segments) {
    const words = segment.words;

    if (words && words.length > 0) {
      // Word-level timestamps available — group into chunks
      let chunkWords: typeof words = [];
      let chunkStart = words[0].start;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        chunkWords.push(word);

        const duration = word.end - chunkStart;
        const isLastWord = i === words.length - 1;
        const reachedMaxWords = chunkWords.length >= maxWordsPerChunk;
        const reachedMinDuration = duration >= minDurationSeconds;
        const reachedMaxDuration = duration >= maxDurationSeconds;
        const shouldFlush =
          isLastWord ||
          (reachedMaxWords && reachedMinDuration) ||
          reachedMaxDuration;

        if (shouldFlush) {
          const chunkEnd = chunkWords[chunkWords.length - 1].end;
          result.push({
            id: `segment-${segmentIndex}`,
            start: chunkStart,
            end: chunkEnd,
            text: chunkWords.map((w) => w.word.trim()).join(" ").trim(),
            words: [...chunkWords],
          });
          segmentIndex++;
          chunkWords = [];
          const nextWord = words[i + 1];
          if (nextWord) chunkStart = nextWord.start;
        }
      }

      // Flush remaining words
      if (chunkWords.length > 0) {
        const chunkEnd = chunkWords[chunkWords.length - 1].end;
        result.push({
          id: `segment-${segmentIndex}`,
          start: chunkStart,
          end: chunkEnd,
          text: chunkWords.map((w) => w.word.trim()).join(" ").trim(),
          words: [...chunkWords],
        });
        segmentIndex++;
      }
    } else {
      // No word timestamps — split text by words and interpolate
      const textWords = segment.text.trim().split(/\s+/);
      if (textWords.length === 0) continue;

      const segDuration = Math.max(segment.end - segment.start, minDurationSeconds);
      const wordDuration = segDuration / textWords.length;

      for (let i = 0; i < textWords.length; i += maxWordsPerChunk) {
        const chunkTextWords = textWords.slice(i, i + maxWordsPerChunk);
        const chunkStart = segment.start + i * wordDuration;
        const chunkEnd = Math.min(
          chunkStart + chunkTextWords.length * wordDuration,
          segment.end,
        );

        // Enforce min/max durations
        let adjustedStart = chunkStart;
        let adjustedEnd = chunkEnd;
        const chunkDuration = adjustedEnd - adjustedStart;

        if (chunkDuration < minDurationSeconds) {
          adjustedEnd = adjustedStart + minDurationSeconds;
          if (adjustedEnd > segment.end) {
            adjustedStart = segment.end - minDurationSeconds;
            adjustedEnd = segment.end;
          }
        }

        if (adjustedEnd - adjustedStart > maxDurationSeconds) {
          adjustedEnd = adjustedStart + maxDurationSeconds;
        }

        result.push({
          id: `segment-${segmentIndex}`,
          start: Math.max(adjustedStart, segment.start),
          end: Math.min(adjustedEnd, segment.end),
          text: chunkTextWords.join(" "),
          words: chunkTextWords.map((w, wi) => ({
            word: w,
            start: segment.start + (i + wi) * wordDuration,
            end: segment.start + (i + wi + 1) * wordDuration,
          })),
        });
        segmentIndex++;
      }
    }
  }

  return result;
}
