import type { TranscriptionSegment } from "@/types/subtitle";
import { correctWithOpenCode } from "./opencode";

export async function correctTranscription(
  segments: TranscriptionSegment[],
  useAiCorrection: boolean = false
): Promise<TranscriptionSegment[]> {
  console.log(`[Correction] Using OpenCode strategy`);
  try {
    return await correctWithOpenCode(segments);
  } catch (error) {
    console.error(`[Correction] OpenCode Strategy failed:`, error);
    return segments;
  }
}
