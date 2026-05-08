# src/workers/

## Responsibility

Background job processors for the video subtitle pipeline. Implements the durable execution side of the system: consumes BullMQ jobs, orchestrates multi-stage media processing (download → transcode → transcribe → correct → burn → upload), manages persistent state transitions on the `Video` entity, and handles lifecycle (idle shutdown, graceful signal handling, error recovery).

## Design Patterns

| Pattern | Usage |
|---|---|
| **Queue-Based Worker** (BullMQ) | `Worker<VideoJob>` consumes jobs from the `"video-processing"` queue, decoupling ingestion from processing. |
| **State Machine** | Video status transitions follow a linear DAG: `PROCESSING → TRANSCRIBING → CORRECTING → BURNING → UPLOADING_OUTPUTS → READY` (or `ERROR` on failure). Each stage advances the status via `updateVideoStatus()`. |
| **Pipeline / Chain of Responsibility** | Each processing stage feeds into the next through the filesystem (temp files) and DB rows. Stages are sequential and synchronous within the job handler. |
| **Scavenger / Cleanup (finally)** | Temp files (`videoPath`, `audioPath`, `thumbnailPath`, `srtPath`, `outputPath`) are always cleaned up in a `finally` block, with errors swallowed to avoid masking job failures. |
| **Idle Shutdown** | A timer-based mechanism terminates the worker process after `WORKER_IDLE_TIMEOUT_MS` of inactivity, enabling container orchestrators to scale down cleanly. |
| **Sailor / Side-Effect at End** | Email notification is dispatched after the primary pipeline succeeds, with failures logged but never propagated — the video is already marked `READY`. |
| **Singleton Entry Point** | `runWorker()` is exported for programmatic launch (e.g., from `start-worker.ts`) and also auto-invoked when the module is the entry point (`isMainModule` guard). |

## Data & Control Flow

```
                         ┌─────────────────┐
                         │   BullMQ Queue   │
                         │  video-processing│
                         └────────┬────────┘
                                  │ Job{ videoId, userId, originalUrl, duration, ... }
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  processVideo(job)                                                  │
│                                                                     │
│  1. updateStatus(PROCESSING)           ───► DB: video.status        │
│  2. Fetch fresh signed URL from DB     ───► Avoids 24h expiry       │
│  3. downloadFromR2(freshOriginalUrl)   ───► temp file (videoPath)   │
│  4. extractAudio(videoPath)            ───► temp file (audioPath)   │
│  5. updateStatus(TRANSCRIBING)         ───► DB: video.status        │
│  6. transcribeWithWhisper(audioPath)   ───► raw transcription       │
│  7. updateStatus(CORRECTING)           ───► DB: video.status        │
│  8. correctTranscription(segments)     ───► corrected segments      │
│  9. splitSegmentsByWords(...)          ───► word-level segments     │
│ 10. saveTranscription(...)             ───► DB: transcription       │
│ 11. writeSrtFile(videoId, segments)    ───► temp file (srtPath)     │
│ 12. updateStatus(BURNING)              ───► DB: video.status        │
│ 13. applySubtitleStyle(video, srt, ...)──► temp file (outputPath)   │
│ 14. updateStatus(UPLOADING_OUTPUTS)    ───► DB: video.status        │
│ 15. uploadToR2(audioPath, ...)         ───► R2: audio/{id}.wav      │
│ 16. extractThumbnail(videoPath)        ───► temp file               │
│ 17. uploadToR2(thumbnail, ...)         ───► R2: thumbnails/{id}.jpg │
│ 18. uploadToR2(outputPath, ...)        ───► R2: videos/{id}/final   │
│ 19. uploadToR2(srtPath, ...)           ───► R2: videos/{id}/subs    │
│ 20. updateStatus(READY, artifacts...)  ───► DB: video.status + URLs │
│ 21. sendVideoReadyEmail(...)           ───► Email (best-effort)     │
│                                                                     │
│  ON ERROR: updateStatus(ERROR) + throw  ───► BullMQ retry/fail     │
│  FINALLY: cleanup(temp files)           ───► Filesystem             │
└─────────────────────────────────────────────────────────────────────┘
```

**Inputs:**
- BullMQ job payload (`VideoJob`): `videoId`, `userId`, `originalUrl`, `duration`, optional `subtitleStyle` / `useAiCorrection`
- Environment: `REDIS_URL`, `WORKER_IDLE_TIMEOUT_MS`

**Outputs:**
- R2 objects: audio file, thumbnail, processed video (with burned-in subtitles), SRT subtitle file
- Database row updates: `Video.status` through the state machine, `Video.processedUrl`/`srtUrl`/`audioUrl`/`thumbnailUrl`
- Database row upserts: `Transcription` record with raw + corrected text, word-level segments, language, confidence
- Email: notification to the video owner (best-effort, non-fatal)

## Integration Points

| Dependency | Role | Coupling |
|---|---|---|
| **BullMQ** (`bullmq`) | Job queue consumer — connects via Redis | Runtime (queue name `"video-processing"`) |
| **Redis** (`REDIS_URL`) | Queue backend and worker coordination | Runtime (env var) |
| **Prisma** (`@prisma/client`) | ORM for `Video` and `Transcription` tables | Compile (type-safe queries) |
| **`@/lib/ffmpeg`** | `downloadFromR2`, `extractAudio`, `extractThumbnail`, `uploadToR2`, `applySubtitleStyle`, `cleanup` | Compile (ESM import) |
| **`@/lib/whisper`** | `transcribeWithWhisper` — runs Whisper inference on audio | Compile |
| **`@/lib/correction`** | `correctTranscription` — GPT-based segment correction | Compile |
| **`@/lib/segment-splitter`** | `splitSegmentsByWords` — word-level segment refinement | Compile |
| **`@/lib/subtitle-artifacts`** | `writeSrtFile` — SRT file generation from segments | Compile |
| **`@/lib/subtitle-styles`** | `SubtitleStyleId` type — style selection for burn-in | Type-only |
| **`@/lib/r2`** | `getSignedUrlFromAny` — refreshes expired R2 signed URLs | Compile |
| **`@/lib/db`** | `prisma` client singleton | Compile |
| **`@/lib/email`** | `sendVideoReadyEmail` — transactional email dispatch | Compile (failure isolated) |
| **R2 (Cloudflare)** | Object storage for source video, audio, thumbnails, processed video, SRT | Remote (via `@/lib/ffmpeg` + `@/lib/r2`) |

## Sub-module Notes

| File | Role |
|---|---|
| `videoProcessor.ts` | Main worker — full pipeline orchestration, lifecycle management, auto-start entry point |
| `transcriptionWorker.ts` | **Empty placeholder** — exported `{}` only. Reserved for future decoupled transcription worker. |
| `exportWorker.ts` | **Guard stub** — fails fast if `REDIS_URL` is missing. Caters to legacy invocation paths. |
