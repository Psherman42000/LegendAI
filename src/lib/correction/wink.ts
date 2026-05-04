import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";
import type { TranscriptionSegment } from "@/types/subtitle";

const nlp = winkNLP(model);

export async function correctWithWink(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  return segments.map((segment) => {
    // Basic capitalization and punctuation cleanup
    const doc = nlp.readDoc(segment.text);
    let corrected = doc.out();

    // Capitalize first letter if it's lowercase
    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }

    return {
      ...segment,
      text: corrected,
    };
  });
}
