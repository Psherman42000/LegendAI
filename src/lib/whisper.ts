import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TranscriptionSegment } from "@/types/subtitle";
import { openai } from "./openai";

interface WhisperApiResponse {
  rawText: string;
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
}

interface WhisperJsonOutput {
  text: string;
  language: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words?: Array<{
      word: string;
      start: number;
      end: number;
      confidence?: number;
    }>;
    avg_logprob?: number;
  }>;
}

type OpenAIWordTimestamp = {
  word: string;
  start: number;
  end: number;
  probability?: number;
};

function normalizeSegments(segments: WhisperJsonOutput["segments"]): TranscriptionSegment[] {
  return segments.map((seg) => ({
    id: `segment-${seg.id}`,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    words: seg.words,
  }));
}

// ─────────────────────────────────────────────
// 1. HTTP API (FastAPI local/Railway)
// ─────────────────────────────────────────────
async function transcribeWithApi(audioPath: string): Promise<WhisperApiResponse | null> {
  const apiUrl = process.env.WHISPER_API_URL;
  if (!apiUrl) return null;

  try {
    const audioBuffer = await fs.readFile(audioPath);
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, path.basename(audioPath));
    formData.append("language", "Portuguese");
    formData.append("word_timestamps", "true");

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error(`Whisper API returned ${res.status}: ${await res.text()}`);
      return null;
    }

    return (await res.json()) as WhisperApiResponse;
  } catch (err) {
    console.error("Whisper API call failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// 2. Local Whisper CLI (fallback)
// ─────────────────────────────────────────────
function findWhisperExecutable(): string {
  if (process.env.WHISPER_EXECUTABLE) {
    return process.env.WHISPER_EXECUTABLE;
  }

  const candidates = [
    "whisper",
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Programs",
      "Python",
      "Python310",
      "Scripts",
      "whisper.exe",
    ),
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Programs",
      "Python",
      "Python311",
      "Scripts",
      "whisper.exe",
    ),
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Programs",
      "Python",
      "Python312",
      "Scripts",
      "whisper.exe",
    ),
  ];

  for (const candidate of candidates) {
    try {
      require("node:fs").accessSync(candidate, require("node:fs").constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return "whisper";
}

async function transcribeWithLocalWhisper(audioPath: string): Promise<WhisperApiResponse | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "whisper-"));
  const whisperModel = process.env.WHISPER_MODEL || (process.env.NODE_ENV === "production" ? "medium" : "small");

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        findWhisperExecutable(),
        [
          audioPath,
          "--model",
          whisperModel,
          "--language",
          "Portuguese",
          "--output_format",
          "json",
          "--output_dir",
          tmpDir,
          "--word_timestamps",
          "True",
          "--verbose",
          "False",
        ],
        { timeout: 300_000 },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve();
          }
        },
      );
    });

    const baseName = path.basename(audioPath, path.extname(audioPath));
    const jsonPath = path.join(tmpDir, `${baseName}.json`);
    const raw = await fs.readFile(jsonPath, "utf8");
    const data: WhisperJsonOutput = JSON.parse(raw);

    const avgLogprob =
      data.segments.reduce((sum, s) => sum + (s.avg_logprob ?? 0), 0) /
      (data.segments.length || 1);
    const confidence = Math.min(1, Math.max(0, 1 + avgLogprob));

    return {
      rawText: data.text.trim(),
      segments: normalizeSegments(data.segments),
      language: data.language === "Portuguese" ? "pt" : data.language,
      confidence,
    };
  } catch {
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ─────────────────────────────────────────────
// 3. OpenAI Whisper API (final fallback)
// ─────────────────────────────────────────────
async function transcribeWithOpenAI(audioPath: string): Promise<WhisperApiResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("No transcription provider available. Set WHISPER_API_URL, WHISPER_EXECUTABLE, or OPENAI_API_KEY.");
  }

  const audioBuffer = await fs.readFile(audioPath);
  const file = new File([audioBuffer], path.basename(audioPath), {
    type: "audio/wav",
  });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  });

  const segments =
    response.segments?.map((seg, idx) => {
      const segmentWithWords = seg as typeof seg & { words?: OpenAIWordTimestamp[] };

      return {
        id: `segment-${idx}`,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        words: segmentWithWords.words?.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.probability,
        })),
      };
    }) ?? [];

  return {
    rawText: response.text.trim(),
    segments,
    language: response.language ?? "pt",
    confidence: 0.92,
  };
}

// ─────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────
export async function transcribeWithWhisper(audioPath: string): Promise<WhisperApiResponse> {
  // Priority 1: HTTP API (local or Railway)
  const apiResult = await transcribeWithApi(audioPath);
  if (apiResult) return apiResult;

  // Priority 2: Local CLI
  const localResult = await transcribeWithLocalWhisper(audioPath);
  if (localResult) return localResult;

  // Priority 3: OpenAI API
  return transcribeWithOpenAI(audioPath);
}
