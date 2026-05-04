# Auto Burn Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the current two-phase flow into a single automatic pipeline where every upload always produces both artifacts (`srtUrl` and `processedUrl`) without any manual export action.

**Architecture:** Keep BullMQ and one primary queue (`video-processing`), but extend `videoProcessor` to perform the full media pipeline end-to-end: transcribe, correct, generate SRT, burn subtitles, upload both outputs, and only then mark the video `READY`. The legacy video export endpoint remains as a compatibility path but no longer drives the default UX. State transitions become explicit and deterministic.

**Tech Stack:** Next.js 16 Route Handlers, BullMQ, Prisma 7, FFmpeg CLI, Whisper (API/CLI/OpenAI fallback), Cloudflare R2 (`@aws-sdk/client-s3`)

---

### Task 1: Add deterministic finalization fields and status support

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/video.ts`

- [ ] **Step 1: Add worker error field and explicit stage statuses in Prisma enum/model**

```prisma
enum VideoStatus {
  UPLOADING
  QUEUED
  PROCESSING
  TRANSCRIBING
  CORRECTING
  BURNING
  UPLOADING_OUTPUTS
  READY
  EXPORTED
  ERROR
}

model Video {
  id            String      @id @default(cuid())
  userId        String
  title         String
  status        VideoStatus @default(UPLOADING)
  originalUrl   String
  processedUrl  String?
  srtUrl        String?
  errorMessage  String?
  // ...keep all existing fields untouched
}
```

- [ ] **Step 2: Update TS status union to include automatic burn stages**

```ts
export type VideoStatus =
  | "UPLOADING"
  | "QUEUED"
  | "PROCESSING"
  | "TRANSCRIBING"
  | "CORRECTING"
  | "BURNING"
  | "UPLOADING_OUTPUTS"
  | "READY"
  | "EXPORTED"
  | "ERROR";
```

- [ ] **Step 3: Apply schema to local database**

Run: `npm run db:push`
Expected: Prisma schema synchronized without errors.

- [ ] **Step 4: Verify app typecheck still succeeds**

Run: `npm run build`
Expected: Build completes successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/types/video.ts
git commit -m "feat: add automatic burn pipeline statuses and error field"
```

---

### Task 2: Create reusable subtitle artifact helpers for worker pipeline

**Files:**
- Modify: `src/lib/subtitle-styles.ts`
- Create: `src/lib/subtitle-artifacts.ts`

- [ ] **Step 1: Add helper to map raw transcription segments into strict subtitle segments**

```ts
// src/lib/subtitle-artifacts.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleSegment } from "@/types/subtitle";
import { generateSRT } from "@/lib/subtitle-styles";

type RawSegment = { id?: string; start: number; end: number; text: string };

export function normalizeSegmentsForSrt(segments: RawSegment[]): SubtitleSegment[] {
  return segments.map((s, i) => ({
    id: s.id ?? `segment-${i}`,
    start: s.start,
    end: s.end,
    text: s.text,
  }));
}

export async function writeSrtFile(videoId: string, segments: RawSegment[]): Promise<string> {
  const subtitleSegments = normalizeSegmentsForSrt(segments);
  const srt = generateSRT(subtitleSegments);
  const srtPath = path.join(process.cwd(), "tmp", `${videoId}.srt`);
  await fs.mkdir(path.dirname(srtPath), { recursive: true });
  await fs.writeFile(srtPath, srt, "utf8");
  return srtPath;
}
```

- [ ] **Step 2: Ensure `generateSRT` remains the single formatting source**

```ts
// src/lib/subtitle-styles.ts
export function generateSRT(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatTimestamp(segment.start, true);
      const end = formatTimestamp(segment.end, true);
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");
}
```

- [ ] **Step 3: Verify worker project compiles after new helper**

Run: `npm run build:worker`
Expected: TypeScript worker compilation passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/subtitle-artifacts.ts src/lib/subtitle-styles.ts
git commit -m "feat: add reusable subtitle artifact helpers for worker"
```

---

### Task 3: Extend `videoProcessor` to produce SRT and burnt MP4 automatically

**Files:**
- Modify: `src/workers/videoProcessor.ts`
- Modify: `src/lib/ffmpeg.ts`

- [ ] **Step 1: Import and wire automatic SRT + burn-in stages in worker**

```ts
import path from "node:path";
import {
  cleanup,
  downloadFromR2,
  extractAudio,
  extractThumbnail,
  uploadToR2,
  applySubtitleStyle,
} from "@/lib/ffmpeg";
import { writeSrtFile } from "@/lib/subtitle-artifacts";
```

- [ ] **Step 2: Add explicit status transitions and automatic outputs**

```ts
await updateVideoStatus(videoId, "TRANSCRIBING");
const rawTranscription = await transcribeWithWhisper(audioPath);

await updateVideoStatus(videoId, "CORRECTING");
const correctedSegments = await correctTranscription(rawTranscription.segments);

const srtPath = await writeSrtFile(videoId, correctedSegments);

await updateVideoStatus(videoId, "BURNING");
const outputPath = path.join(process.cwd(), "tmp", `${videoId}-subtitled.mp4`);
await applySubtitleStyle(videoPath, srtPath, "classic", outputPath);

await updateVideoStatus(videoId, "UPLOADING_OUTPUTS");
const processedUrl = await uploadToR2(outputPath, `videos/${videoId}/final.mp4`);
const srtUrl = await uploadToR2(srtPath, `videos/${videoId}/subtitles.srt`);
```

- [ ] **Step 3: Enforce READY only when both artifacts exist**

```ts
await updateVideoStatus(videoId, "READY", {
  processedAt: new Date(),
  processedUrl,
  srtUrl,
  audioUrl,
  thumbnailUrl,
  errorMessage: null,
});
```

- [ ] **Step 4: Add centralized error persistence in worker**

```ts
try {
  // full pipeline
} catch (error) {
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown worker error",
    },
  }).catch(() => undefined);
  throw error;
}
```

- [ ] **Step 5: Ensure temp cleanup includes new files**

```ts
await cleanup([videoPath, audioPath, thumbnailPath, srtPath, outputPath]);
```

- [ ] **Step 6: Verify build + worker compile**

Run: `npm run build && npm run build:worker`
Expected: Both commands succeed.

- [ ] **Step 7: Commit**

```bash
git add src/workers/videoProcessor.ts src/lib/ffmpeg.ts
git commit -m "feat: make video worker generate srt and burnt mp4 automatically"
```

---

### Task 4: Stop manual export from being required in default flow

**Files:**
- Modify: `src/components/editor/ExportPanel.tsx`
- Modify: `src/app/api/videos/[id]/export/route.ts`

- [ ] **Step 1: Keep SRT/VTT download endpoints, mark VIDEO export as optional legacy**

```ts
if (body.format === "VIDEO") {
  return NextResponse.json(
    {
      ok: false,
      error: "Export manual desabilitado no fluxo automático. Aguarde status READY para baixar o MP4 final.",
    },
    { status: 409 },
  );
}
```

- [ ] **Step 2: Update UI copy to remove manual export expectation**

```tsx
<Button onClick={downloadSRT}>Baixar SRT</Button>
<Badge>Legenda e vídeo final são gerados automaticamente</Badge>
```

- [ ] **Step 3: Remove polling loop tied to EXPORTED in `ExportPanel`**

```ts
// delete exportVideo() polling on status === "EXPORTED"
// keep only direct subtitle downloads
```

- [ ] **Step 4: Validate frontend build**

Run: `npm run build`
Expected: Build succeeds and route tree includes `/api/videos/[id]/export`.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/ExportPanel.tsx src/app/api/videos/[id]/export/route.ts
git commit -m "refactor: remove manual video export dependency from default ux"
```

---

### Task 5: Harden queue startup and fail-fast behavior for production reliability

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/workers/videoProcessor.ts`
- Modify: `src/workers/exportWorker.ts`

- [ ] **Step 1: Make queue enqueue fail loudly when Redis is missing**

```ts
function getVideoQueue(): Queue<VideoJobPayload> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to enqueue video jobs");
  }

  if (!videoQueue) {
    videoQueue = new Queue<VideoJobPayload>("video-processing", {
      connection: { url: redisUrl },
    });
  }

  return videoQueue;
}
```

- [ ] **Step 2: Require Redis at worker boot with explicit error**

```ts
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start video worker");
}

const connection = { connection: { url: process.env.REDIS_URL } };
```

- [ ] **Step 3: Apply same fail-fast guard to export worker (legacy path)**

```ts
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start export worker");
}
```

- [ ] **Step 4: Verify boot error is deterministic without Redis**

Run: `npx tsx src/workers/videoProcessor.ts`
Expected: immediate explicit `REDIS_URL is required...` error.

- [ ] **Step 5: Verify successful worker boot with Redis configured**

Run: `npm run worker:dev`
Expected: process stays running, no `Worker requires a connection` error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queue.ts src/workers/videoProcessor.ts src/workers/exportWorker.ts
git commit -m "fix: enforce redis fail-fast for queue and workers"
```

---

### Task 6: Add production readiness checks and runbook updates

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/production-checklist-auto-burn.md`

- [ ] **Step 1: Add auto-pipeline operational section to README**

```md
## Auto Burn Pipeline (Production)

Required services:
- PostgreSQL
- Redis
- Worker process (`npm run worker:dev` for local, process manager in prod)
- FFmpeg available in PATH or `FFMPEG_PATH`
- Whisper provider (`WHISPER_API_URL` or `WHISPER_EXECUTABLE` or `OPENAI_API_KEY`)
- Cloudflare R2 (`R2_*` vars)

READY means both files exist:
- `processedUrl` (burnt MP4)
- `srtUrl` (subtitle file)
```

- [ ] **Step 2: Add production checklist document**

```md
# Production Checklist - Auto Burn Pipeline

- [ ] `REDIS_URL` configured and reachable from web + worker
- [ ] Worker process supervised (pm2/systemd/docker restart policy)
- [ ] FFmpeg executable verified (`ffmpeg -version`)
- [ ] Whisper provider health verified (`/health` for API mode)
- [ ] R2 upload/download smoke test executed
- [ ] End-to-end upload test confirms `READY` with `processedUrl` + `srtUrl`
- [ ] Alerting configured for queue failures and repeated ERROR status
```

- [ ] **Step 3: Validate docs and build together**

Run: `npm run build`
Expected: Build succeeds after doc-only changes.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/plans/production-checklist-auto-burn.md
git commit -m "docs: add production runbook for automatic burn pipeline"
```

---

### Task 7: End-to-end verification before production rollout

**Files:**
- Modify (if needed): `src/workers/videoProcessor.ts`
- Modify (if needed): `src/lib/whisper.ts`
- Modify (if needed): `src/lib/ffmpeg.ts`

- [ ] **Step 1: Start required local services**

Run:

```bash
# terminal 1
npm run dev

# terminal 2
npm run worker:dev

# terminal 3 (optional if using local whisper API)
cd whisper-api && python main.py
```

Expected: app and worker both running without startup errors.

- [ ] **Step 2: Perform real upload from UI and track status progression**

Expected status path in DB/API:

```text
QUEUED -> PROCESSING -> TRANSCRIBING -> CORRECTING -> BURNING -> UPLOADING_OUTPUTS -> READY
```

- [ ] **Step 3: Validate final artifacts exist and are downloadable**

Run:

```bash
curl -s http://localhost:3000/api/videos/<VIDEO_ID>
```

Expected JSON fields:
- `data.status === "READY"`
- `data.processedUrl` is non-empty
- `data.srtUrl` is non-empty

- [ ] **Step 4: Force one failure and verify ERROR recording**

Method: set invalid `WHISPER_API_URL` and process one video.

Expected:
- status becomes `ERROR`
- `errorMessage` filled with useful reason

- [ ] **Step 5: Final verification commands**

Run: `npm run build && npm run build:worker`
Expected: both pass.

- [ ] **Step 6: Commit stabilization fixes (if any)**

```bash
git add src/workers/videoProcessor.ts src/lib/whisper.ts src/lib/ffmpeg.ts
git commit -m "chore: stabilize automatic burn pipeline e2e"
```

---

### Task 8: Controlled production rollout

**Files:**
- Modify: deployment environment variables and process manager config (outside repo if applicable)

- [ ] **Step 1: Deploy with auto pipeline enabled for canary scope**

Run: deploy command of your platform.
Expected: only canary users/jobs use the new automatic path.

- [ ] **Step 2: Observe queue and failure metrics for 24h**

Expected thresholds:
- success rate >= 95%
- no stuck jobs over SLA
- no READY videos missing artifacts

- [ ] **Step 3: Expand to 100% traffic**

Run: enable full rollout in env/config.
Expected: all new uploads follow automatic pipeline.

- [ ] **Step 4: Decommission manual video export flow once stable**

Run: remove legacy trigger usage in UI and route behavior permanently.
Expected: no dependency on manual export remains.

- [ ] **Step 5: Commit any in-repo config/docs updates**

```bash
git add .
git commit -m "release: rollout automatic burn pipeline to production"
```
