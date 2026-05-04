import type { TranscriptionSegment } from "@/types/subtitle";
import { correctWithOpenAI } from "./openai";

export async function correctTranscription(
  segments: TranscriptionSegment[],
  useAiCorrection: boolean = false
): Promise<TranscriptionSegment[]> {
  console.log(`[Correction] Using OpenAI strategy`);
  try {
    return await correctWithOpenAI(segments);
  } catch (error) {
    console.error(`[Correction] OpenAI Strategy failed:`, error);
    return segments;
  }
}
