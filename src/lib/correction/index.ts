import type { TranscriptionSegment } from "@/types/subtitle";
import { correctWithGemini } from "./gemini";
import { correctWithOpenCode } from "./opencode";
import { correctWithOpenAI } from "./openai";

export async function correctTranscription(
  segments: TranscriptionSegment[],
  useAiCorrection: boolean = false
): Promise<TranscriptionSegment[]> {
  if (!useAiCorrection) {
    console.log("[Correction] AI correction disabled, returning original segments");
    return segments;
  }

  console.log(`[Correction] Attempting Gemini strategy`);
  try {
    return await correctWithGemini(segments);
  } catch (error) {
    console.warn(`[Correction] Gemini Strategy failed, falling back to OpenCode:`, error instanceof Error ? error.message : error);
    try {
      console.log(`[Correction] Attempting OpenCode strategy`);
      return await correctWithOpenCode(segments);
    } catch (opencodeError) {
      console.warn(`[Correction] OpenCode Strategy failed, falling back to OpenAI:`, opencodeError instanceof Error ? opencodeError.message : opencodeError);
      try {
        console.log(`[Correction] Attempting OpenAI strategy`);
        return await correctWithOpenAI(segments);
      } catch (openaiError) {
        console.error(`[Correction] All strategies failed, returning original segments`);
        console.error(`[Correction] OpenAI Strategy also failed:`, openaiError);
        return segments;
      }
    }
  }
}
