import type { TranscriptionSegment } from "@/types/subtitle";
import { correctWithWink } from "./wink";
import { correctWithOpenAI } from "./openai";
import { correctWithLocalLLM } from "./local-llm";

export async function correctTranscription(
  segments: TranscriptionSegment[],
  useAiCorrection: boolean = false
): Promise<TranscriptionSegment[]> {
  if (!useAiCorrection) {
    console.log(`[Correction] Using default strategy: wink`);
    return await correctWithWink(segments);
  }

  const aiStrategy = process.env.AI_CORRECTION_STRATEGY || "local_llm";

  try {
    console.log(`[Correction] Using AI strategy: ${aiStrategy}`);
    
    if (aiStrategy === "openai") {
      return await correctWithOpenAI(segments);
    } 
    
    if (aiStrategy === "local_llm") {
      return await correctWithLocalLLM(segments);
    }
    
    return await correctWithWink(segments);
    
  } catch (error) {
    console.error(`[Correction] AI Strategy ${aiStrategy} failed, falling back to wink:`, error);
    return await correctWithWink(segments);
  }
}
