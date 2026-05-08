# src/lib/

## Responsibility

The core service layer for the LegendaAI subtitle-processing pipeline. This directory encapsulates all infrastructure integrations, domain logic, and external API clients that underpin the application's primary workflow: video upload → audio extraction → transcription → segmentation → AI correction → subtitle styling → artifact export.

It acts as a **facade over heterogeneous infrastructure** — presenting a unified, environment-agnostic API surface to consumers (API routes, server components, workers) while managing 8+ external service integrations (NextAuth, Prisma/PostgreSQL, BullMQ/Redis, FFmpeg, Whisper, OpenAI, Google Gemini, Resend, Mercado Pago, Cloudflare R2, OpenCode SDK, node-llama-cpp, wink-nlp).

## Design Patterns

| Pattern | Where | Rationale |
|---|---|---|
| **Singleton** | `db.ts`, `queue.ts`, `openai.ts`, `opencode.ts`, `r2.ts`, `email.ts`, `correction/local-llm.ts` | Expensive clients (Prisma, BullMQ Queue, OpenAI SDK, S3Client, Resend) are initialized once and cached via module-level variables / `globalThis` for Prisma to survive HMR in dev. |
| **Strategy** | `whisper.ts` (transcribeWithApi → transcribeWithLocalWhisper → transcribeWithOpenAI), `correction/index.ts` (Gemini → OpenCode → OpenAI) | Cascading fallback chains where each strategy is tried in priority order; the first to return a non-null result wins. The correction orchestrator additionally propagates exceptions through a nested try/catch ladder. |
| **Lazy Initialization** | `queue.ts` (`getVideoQueue()`), `r2.ts` (`getS3Client()`), `email.ts` (`getResend()`), `opencode.ts` (`getOpencodeClient()`), `correction/local-llm.ts` (`initLlama()`) | Infrastructure clients are created on first use, not at import time, allowing the app to boot without all environment variables configured. |
| **Adapter** | `auth.ts` — PrismaAdapter bridges NextAuth.js session management to the PostgreSQL/Prisma data layer. | Standard NextAuth pattern: the adapter translates between NextAuth's session/user/account models and Prisma's schema. |
| **Template Method** | `email.ts` — `baseTemplate()` provides the HTML skeleton; specialized `send*Email()` functions supply title + body content. | Dry HTML generation with consistent dark-theme branding across all transactional emails. |
| **Builder** | `ffmpeg.ts` — `buildExtractAudioCommand()` and `buildExtractThumbnailCommand()` construct FFmpeg argument arrays via named functions. | Separates command construction from execution, enabling unit testing of argument generation without running FFmpeg. |
| **Strategy + Bridge** | `correction/index.ts` — the orchestrator delegates to `correction/gemini.ts`, `correction/opencode.ts`, `correction/openai.ts`, `correction/local-llm.ts`, `correction/wink.ts` via a common interface (`TranscriptionSegment[] => Promise<TranscriptionSegment[]>`). | The `correction/` subdirectory isolates each provider's protocol-specific logic (REST API, SDK, local process) behind a uniform function signature. |
| **Fallback / Circuit Breaker** | `whisper.ts` — three-tier fallback (HTTP API → local CLI → OpenAI API). `correction/index.ts` — three-tier fallback (Gemini → OpenCode → OpenAI). | Ensures the pipeline degrades gracefully when a provider is unavailable or returns errors, logging warnings at each fallback level. |
| **Data Transfer Object (DTO)** | `queue.ts` — `VideoJobPayload` type; `whisper.ts` — `WhisperApiResponse`, `WhisperJsonOutput`; `segment-splitter.ts` — `WordLevelSegment`, `SplitOptions`, `SpeedConfig`. | Explicit typed interfaces define the contract between pipeline stages, enabling static type checking at stage boundaries. |
| **Null Object / Silent Failure** | `email.ts` — returns `void` when `RESEND_API_KEY` is unset. `queue.ts` — `triggerWorker()` silently catches fetch errors. R2 functions check env vars before operations. | Degradation over crash: missing optional infrastructure doesn't block the main flow. |
| **Validation** | `subtitle-artifacts.ts` — `validateSegment()` throws on non-finite or inverted times. `correction/gemini.ts`, `correction/opencode.ts` — `isValidTranscriptionResponse()` validates LLM output structure. | Fail-fast on corrupt data before it reaches file-writing or downstream consumers. |
| **Normalization** | `srt-parser.ts` — `parseVtt()` normalizes VTT → SRT before delegation. `correction/opencode.ts` — JSON extraction from markdown code blocks. | Incoming data from diverse sources is normalized to a canonical format before processing. |
| **Speed Presets** | `segment-splitter.ts` — three named presets (`fast`, `normal`, `slow`) encoding word-count, duration, and pause-threshold parameters. | A lightweight Policy object pattern: presets encapsulate subtitle pacing strategy, selectable at call time with optional parameter overrides. |

## Data & Control Flow

### Primary Pipeline (Video Processing)

The following flow traces the path from video upload to deliverable artifacts:

```
Upload (API Route)
  │
  ▼
queue.enqueueVideoJob({ videoId, userId, originalUrl, duration, useAiCorrection? })
  │  Writes to BullMQ "video-processing" queue
  │  Best-effort HTTP trigger to worker (cron is backup)
  ▼
Worker (videoProcessor.ts)
  │
  ├─► ffmpeg.downloadFromR2(url)       ── Download video from Cloudflare R2
  ├─► ffmpeg.extractAudio(video)        ── FFmpeg: video → 16kHz mono WAV
  ├─► whisper.transcribeWithWhisper(audio) ── 3-tier fallback transcription
  │     ├─ 1. HTTP API (FastAPI / Railway)
  │     ├─ 2. Local Whisper CLI (python whisper)
  │     └─ 3. OpenAI Whisper API (whisper-1)
  │     Returns { rawText, segments[], language, confidence }
  ├─► segment-splitter.splitSegmentsByWords(segments, { speed })
  │     Groups word-timestamped segments into subtitle lines using
  │     pause-based heuristics with speed-preset boundaries.
  │     Falls back to linear interpolation when word timestamps absent.
  ├─► correction.correctTranscription(segments, useAiCorrection)
  │     ┌─ Disabled: passthrough
  │     └─ Enabled:  Gemini → OpenCode → OpenAI (fallback chain)
  │           Each: GPT-4o-mini / gemini-2.5-flash / deepseek-v4-flash
  │           via shared "Leandro" persona prompt (7 rules, PT-BR focused)
  ├─► subtitle-styles.generateSRT / generateVTT(segments)
  ├─► subtitle-artifacts.writeSrtFile(videoId, segments)
  │     Validates segments, writes to tmp/, returns path
  ├─► ffmpeg.applySubtitleStyle(video, srt, styleId, output)
  │     FFmpeg subtitle burn-in with configurable ASS styling
  ├─► ffmpeg.uploadToR2(output, key)    ── Upload processed video to R2
  └─► ffmpeg.cleanup([tmp files])       ── Ephemeral file deletion
```

### Correction Submodule (correction/)

```
correctTranscription(segments, useAiCorrection)
  │
  ├─ false ──► return segments (passthrough)
  │
  └─ true ──►
      try:        correctWithGemini(segments)
      catch ──►   try:        correctWithOpenCode(segments)
                  catch ──►   try:        correctWithOpenAI(segments)
                              catch ──►   return segments (degraded)

Individual strategies:
  Gemini:    REST POST → generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
             JSON response extraction with markdown code-block stripping
             Validation via isValidTranscriptionResponse()
  OpenCode:  @opencode-ai/sdk → session.create → session.prompt → session.delete
             Model: opencode-go/deepseek-v4-flash (configurable via OPENCODE_MODEL)
             JSON extraction, validation, session cleanup in finally block
  OpenAI:    openai.responses.create({ model: "gpt-4o-mini", ... })
             JSON parse, fallback to raw text assignment
  Local LLM: node-llama-cpp → download GGUF model → LlamaChatSession → prompt
             Qwen2.5-1.5B-Instruct GGUF (configurable via LOCAL_LLM_MODEL_URL)
  Wink NLP:  wink-nlp → basic capitalization only (lightweight fallback)
```

### Authentication Flow

```
auth.ts (NextAuthOptions)
  │
  ├─ Adapter: PrismaAdapter(prisma) ── persists users/accounts/sessions to PostgreSQL
  ├─ Provider: GoogleProvider ── OAuth 2.0 with select_account prompt
  ├─ Session: database strategy
  ├─ Callback: session({ session, user }) → injects user.id + email into session
  └─ Sign-in page: /login
```

### Payment Flow (Mercado Pago)

```
Subscription:  criarAssinatura({ userId, userEmail, userName, planId, backUrl })
                 → PreApproval.create() with mpPlanId
                 → Returns { initPoint, subscriptionId }
One-time (PIX)::criarPagamentoAvulso({..., method: "PIX" })
                 → Payment.create() with payment_method_id: "pix"
                 → Returns { pixQrCode, pixQrCodeText, pixExpiration }
One-time (CARD)::criarPagamentoAvulso({..., method: "CARD" })
                 → Preference.create() with items, back_urls, auto_return
                 → Returns { preferenceId, initPoint }
Query:           consultarPagamento(mpPaymentId) → Payment.get()
                 consultarAssinatura(mpSubscriptionId) → PreApproval.get()
```

### R2 Storage Layer

```
uploadBufferToR2(buffer, key, contentType)  ── PutObjectCommand → returns public URL
deleteFromR2(key)                           ── DeleteObjectCommand
getSignedDownloadUrl(key, expiresIn)         ── Presigned GET URL (private bucket)
getPublicUrl(key, expiresIn)                 ── Alias for getSignedDownloadUrl
getSignedUrlFromAny(urlOrKey)                ── Normalizes URL-or-key → fresh signed URL
extractR2Key(url)                            ── Strips public URL / endpoint prefix → key
```

### Worker Spawning

```
buildWorkerSpawnCommand({ cwd, nodePath })
  → { command: nodePath, args: [tsx, --env-file=.env.local, src/workers/videoProcessor.ts] }
startDetachedWorker({ cwd, nodePath, env, onError, spawnWorker })
  → spawn() with detached:true, unref() → { ok: true, pid } | { ok: false, error }
```

## Integration Points

### External Dependencies

| Module | External Package / Service | Purpose |
|---|---|---|
| `auth.ts` | `next-auth`, `@auth/prisma-adapter`, Google OAuth | Authentication & session management |
| `db.ts` | `@prisma/client`, `@prisma/adapter-pg` | PostgreSQL ORM with connection pooling adapter |
| `queue.ts` | `bullmq` | Redis-backed job queue (video-processing) |
| `whisper.ts` | OpenAI SDK (`openai`), local `whisper` CLI | Automatic speech recognition (3-tier fallback) |
| `ffmpeg.ts` | System `ffmpeg` binary | Audio extraction (16kHz mono WAV), thumbnail capture, subtitle burn-in |
| `openai.ts` | `openai` SDK | GPT-4o-mini for keyword insights, Whisper API fallback for transcription |
| `email.ts` | `resend` | Transactional email (welcome, video-ready, receipt, limit, webhook) |
| `mercadopago.ts` | `mercadopago` SDK | Subscription (PreApproval), one-time payments (Payment, Preference) |
| `plans.ts` | (none) | Plan definitions, pricing logic |
| `r2.ts` | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Cloudflare R2 object storage (S3-compatible) |
| `correction/openai.ts` | `openai` SDK | GPT-4o-mini text correction |
| `correction/gemini.ts` | Google Gemini REST API | Gemini 2.5 Flash text correction |
| `correction/opencode.ts` | `@opencode-ai/sdk` | OpenCode deepseek-v4-flash text correction |
| `correction/local-llm.ts` | `node-llama-cpp` | Local GGUF model inference (Qwen2.5-1.5B) |
| `correction/wink.ts` | `wink-nlp`, `wink-eng-lite-web-model` | Lightweight NLP capitalization |
| `opencode.ts` | `@opencode-ai/sdk` | OpenCode client singleton |
| `google-auth-client.ts` | `next-auth/react` | Client-side Google sign-in with account picker |
| `health.ts` | `ioredis`, `@aws-sdk/client-s3` | Runtime health checks (PostgreSQL, Redis, R2) |
| `worker-spawn.ts` | Node.js `child_process` | Detached worker process lifecycle |

### Consumer Modules (Who imports from `src/lib/`)

| Consumer | Modules Imported |
|---|---|
| **API Routes** (`src/app/api/...`) | `auth.ts`, `db.ts`, `queue.ts`, `whisper.ts`, `ffmpeg.ts`, `r2.ts`, `mercadopago.ts`, `email.ts`, `health.ts`, `correction/index.ts`, `subtitle-artifacts.ts`, `subtitle-styles.ts`, `segment-splitter.ts`, `srt-parser.ts` |
| **Workers** (`src/workers/videoProcessor.ts`) | `db.ts`, `whisper.ts`, `ffmpeg.ts`, `r2.ts`, `correction/index.ts`, `subtitle-artifacts.ts`, `subtitle-styles.ts`, `segment-splitter.ts`, `openai.ts` |
| **Server Components** (`src/app/...`) | `db.ts`, `plans.ts`, `utils.ts` |
| **Client Components** (`"use client"`) | `google-auth-client.ts`, `utils.ts` |
| **NextAuth Route Handler** (`src/app/api/auth/[...nextauth]/...`) | `auth.ts` |
| **Health Endpoint** (`src/app/api/health/...`) | `health.ts` |
| **Billing UI / API** | `mercadopago.ts`, `plans.ts`, `avulso-pricing.ts` |
| **Subtitle Editor** | `subtitle-styles.ts`, `srt-parser.ts`, `segment-splitter.ts` |
| **Cron / Scheduled Jobs** | `queue.ts` (`triggerWorker()`) |

### Environment Variables Required

| Variable | Module(s) | Required |
|---|---|---|
| `DATABASE_URL` | `db.ts` | Yes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `auth.ts` | Yes (for Google auth) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | `auth.ts` | Yes (NextAuth) |
| `REDIS_URL` | `queue.ts`, `health.ts` | Yes (for queue) |
| `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` | `r2.ts`, `ffmpeg.ts`, `health.ts` | Yes (for storage) |
| `OPENAI_API_KEY` | `openai.ts`, `whisper.ts`, `correction/openai.ts` | Conditional (transcription fallback, correction) |
| `GEMINI_API_KEY` | `correction/gemini.ts` | Conditional (correction primary) |
| `OPENCODE_BASE_URL` | `opencode.ts` | Conditional (correction secondary) |
| `RESEND_API_KEY` | `email.ts` | Conditional (email) |
| `MP_ACCESS_TOKEN` | `mercadopago.ts` | Conditional (payments) |
| `MP_PLAN_STARTER_ID`, `MP_PLAN_PRO_ID`, `MP_PLAN_UNLIMITED_ID` | `plans.ts` | Conditional (subscription plans) |
| `WHISPER_API_URL` | `whisper.ts` | Conditional (transcription tier 1) |
| `WHISPER_EXECUTABLE`, `WHISPER_MODEL` | `whisper.ts` | Conditional (transcription tier 2) |
| `FFMPEG_PATH` | `ffmpeg.ts` | Conditional (binary path override) |
| `WORKER_START_URL`, `WORKER_SECRET` | `queue.ts` | Conditional (on-demand worker trigger) |
| `LOCAL_LLM_MODEL_URL` | `correction/local-llm.ts` | Conditional (local correction) |
| `NEXT_PUBLIC_APP_URL` | `utils.ts`, `mercadopago.ts`, `email.ts` | Recommended |
| `GEMINI_MODEL` | `correction/gemini.ts` | Optional (default: gemini-2.5-flash) |
| `OPENCODE_MODEL` | `correction/opencode.ts` | Optional (default: opencode-go/deepseek-v4-flash) |
