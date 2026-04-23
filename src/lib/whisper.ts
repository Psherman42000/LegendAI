import fs from "node:fs/promises";
import type { TranscriptionSegment } from "@/types/subtitle";

export async function transcribeWithWhisper(audioPath: string): Promise<{
  rawText: string;
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
}> {
  const rawText = await fs
    .readFile(audioPath, "utf8")
    .catch(() => "transcrição de demonstração em português brasileiro");

  return {
    rawText,
    segments: [
      {
        id: "segment-1",
        start: 0,
        end: 2.4,
        text: "eu tava testando a legenda ai né",
      },
      {
        id: "segment-2",
        start: 2.4,
        end: 5.1,
        text: "e ficou bem mais natural pra quem fala português",
      },
    ],
    language: "pt",
    confidence: 0.92,
  };
}
