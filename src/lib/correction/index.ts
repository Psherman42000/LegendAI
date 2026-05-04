import type { TranscriptionSegment } from "@/types/subtitle";
import { correctWithOpenCode } from "./opencode";
import { correctWithOpenAI } from "./openai";

export async function correctTranscription(
  segments: TranscriptionSegment[],
  useAiCorrection: boolean = false
): Promise<TranscriptionSegment[]> {
  console.log(`[Correction] Attempting OpenCode strategy`);
  try {
    return await correctWithOpenCode(segments);
  } catch (error) {
    console.warn(`[Correction] OpenCode Strategy failed, falling back to OpenAI:`, error instanceof Error ? error.message : error);
    try {
      console.log(`[Correction] Attempting OpenAI strategy`);
      return await correctWithOpenAI(segments);
    } catch (openaiError) {
      console.error(`[Correction] OpenAI Strategy also failed:`, openaiError);
      return segments;
    }
  }
}
