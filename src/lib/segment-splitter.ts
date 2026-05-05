import type { TranscriptionSegment } from "@/types/subtitle";

export type SpeedPreset = "fast" | "normal" | "slow";

export interface SplitOptions {
  /** Speed preset controlling word grouping behaviour (default: "normal") */
  speed?: SpeedPreset;
  /** Override the preset's minimum duration in seconds per subtitle line */
  minDurationSeconds?: number;
  /** Override the preset's maximum duration in seconds per subtitle line */
  maxDurationSeconds?: number;
}

/**
 * Speed presets for dynamic word grouping.
 *
 * - `minWords` / `maxWords`: word count boundaries per subtitle line
 * - `minDuration` / `maxDuration`: time boundaries per subtitle line
 * - `pauseThreshold`: gap (seconds) between consecutive words that forces a break
 * - `tightThreshold`: gap (seconds) below which words are considered tightly
 *   grouped and should not be separated
 */
export interface SpeedConfig {
  minWords: number;
  maxWords: number;
  minDuration: number;
  maxDuration: number;
  pauseThreshold: number;
  tightThreshold: number;
}

const SPEED_PRESETS: Record<SpeedPreset, SpeedConfig> = {
  fast: {
    minWords: 1,
    maxWords: 2,
    minDuration: 0.5,
    maxDuration: 2.0,
    pauseThreshold: 0.3,
    tightThreshold: 0.1,
  },
  normal: {
    minWords: 2,
    maxWords: 4,
    minDuration: 0.8,
    maxDuration: 3.0,
    pauseThreshold: 0.3,
    tightThreshold: 0.1,
  },
  slow: {
    minWords: 3,
    maxWords: 5,
    minDuration: 1.2,
    maxDuration: 4.0,
    pauseThreshold: 0.3,
    tightThreshold: 0.1,
  },
};

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
 * Apply duration clamping to a chunk's start/end times.
 */
function clampDuration(
  start: number,
  end: number,
  minDuration: number,
  maxDuration: number,
  segmentStart: number,
  segmentEnd: number,
): { start: number; end: number } {
  const duration = end - start;

  if (duration < minDuration) {
    end = start + minDuration;
    if (end > segmentEnd) {
      start = segmentEnd - minDuration;
      end = segmentEnd;
    }
  }

  if (end - start > maxDuration) {
    end = start + maxDuration;
  }

  return {
    start: Math.max(start, segmentStart),
    end: Math.min(end, segmentEnd),
  };
}

/**
 * Flush accumulated chunk words into a `WordLevelSegment`, reset state.
 */
function flushChunk(
  chunkWords: WordLevelSegment["words"],
  chunkStart: number,
  segmentIndex: number,
): WordLevelSegment {
  const chunkEnd = chunkWords[chunkWords.length - 1].end;
  return {
    id: `segment-${segmentIndex}`,
    start: chunkStart,
    end: chunkEnd,
    text: chunkWords.map((w) => w.word.trim()).join(" ").trim(),
    words: [...chunkWords],
  };
}

/**
 * Split transcription segments into smaller word-level chunks suitable for
 * subtitle display, using pause-based grouping driven by a speed preset.
 *
 * Words are grouped by:
 * 1. Natural speech pauses (gap > `pauseThreshold`) — forces a break.
 * 2. Tight speech (gap < `tightThreshold`) — keeps words together.
 * 3. Speed preset word-count / duration boundaries.
 *
 * When word timestamps are missing, the segment text is split heuristically
 * and timestamps are interpolated using the same speed-preset constraints.
 *
 * @param segments - Array of transcription segments from Whisper.
 * @param options  - Splitting options (speed preset + optional overrides).
 * @returns Word-level segments ready for SRT/VTT generation.
 */
export function splitSegmentsByWords(
  segments: TranscriptionSegment[],
  options: SplitOptions = {},
): WordLevelSegment[] {
  const speed: SpeedPreset = options.speed ?? "normal";
  const preset = SPEED_PRESETS[speed];
  const minDurationSeconds = options.minDurationSeconds ?? preset.minDuration;
  const maxDurationSeconds = options.maxDurationSeconds ?? preset.maxDuration;

  const result: WordLevelSegment[] = [];
  let segmentIndex = 0;

  for (const segment of segments) {
    const words = segment.words;

    if (words && words.length > 0) {
      // ——— Word-level timestamps available — pause-based grouping ———
      let chunkWords: WordLevelSegment["words"] = [];
      let chunkStart = words[0].start;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        chunkWords.push(word);

        // Gap to the next word (if any)
        const nextWord = words[i + 1];
        const gapToNext = nextWord ? nextWord.start - word.end : Infinity;

        const chunkDuration = word.end - chunkStart;
        const isLastWord = i === words.length - 1;
        const naturalPause = gapToNext > preset.pauseThreshold;
        const tightSpeech = gapToNext < preset.tightThreshold && !isLastWord;
        const reachedMaxWords = chunkWords.length >= preset.maxWords;
        const reachedMinWords = chunkWords.length >= preset.minWords;
        const reachedMaxDuration = chunkDuration >= maxDurationSeconds;

        // Determine whether to flush:
        // - Always flush on last word or max duration exceeded.
        // - Flush on natural pause IF we already have at least minWords.
        // - Flush when we hit maxWords AND minWords is satisfied,
        //   but NOT when words are tightly grouped (gap < tightThreshold).
        const shouldFlush =
          isLastWord ||
          reachedMaxDuration ||
          (naturalPause && reachedMinWords) ||
          (!tightSpeech && reachedMaxWords && reachedMinWords);

        if (shouldFlush) {
          // Apply duration clamping
          const { start: clampedStart, end: clampedEnd } = clampDuration(
            chunkStart,
            word.end,
            minDurationSeconds,
            maxDurationSeconds,
            segment.start,
            segment.end,
          );

          // Recompute text/words from clamped bounds if they differ noticeably
          const finalEnd = Math.min(clampedEnd, word.end);
          const finalStart = Math.max(clampedStart, chunkStart);

          result.push({
            id: `segment-${segmentIndex}`,
            start: finalStart,
            end: finalEnd,
            text: chunkWords.map((w) => w.word.trim()).join(" ").trim(),
            words: [...chunkWords],
          });
          segmentIndex++;

          // Reset for next chunk
          chunkWords = [];
          if (nextWord) chunkStart = nextWord.start;
        }
      }

      // Flush remaining words
      if (chunkWords.length > 0) {
        result.push(flushChunk(chunkWords, chunkStart, segmentIndex));
        segmentIndex++;
      }
    } else {
      // ——— No word timestamps — split text by words and interpolate ———
      const textWords = segment.text.trim().split(/\s+/);
      if (textWords.length === 0) continue;

      const segDuration = Math.max(
        segment.end - segment.start,
        minDurationSeconds,
      );
      const wordDuration = segDuration / textWords.length;

      for (let i = 0; i < textWords.length; i += preset.maxWords) {
        const chunkTextWords = textWords.slice(i, i + preset.maxWords);
        const chunkStart = segment.start + i * wordDuration;
        const chunkEnd = Math.min(
          chunkStart + chunkTextWords.length * wordDuration,
          segment.end,
        );

        const { start: adjustedStart, end: adjustedEnd } = clampDuration(
          chunkStart,
          chunkEnd,
          minDurationSeconds,
          maxDurationSeconds,
          segment.start,
          segment.end,
        );

        result.push({
          id: `segment-${segmentIndex}`,
          start: adjustedStart,
          end: adjustedEnd,
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
