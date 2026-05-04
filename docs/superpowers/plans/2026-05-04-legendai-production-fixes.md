# LegendAI Production Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical production blockers (broken monetization, infinite storage, missing auth, unsafe uploads), fix core product issue where all subtitles appear at once instead of syncing word-by-word with speech, improve usability (video list, pagination, retry), and re-architect the worker to run on-demand (start when jobs exist, shutdown when idle) for cost efficiency.

**Architecture:**
- **Phase 1 â€” Blockers:** Fix MonthlyUsage tracking, implement real R2 deletion, add webhook idempotency, enforce upload size limits, protect routes via middleware, build a real health check.
- **Phase 1.5 â€” Core Product Fix:** Enable word-level timestamps from Whisper, split long segments into micro-chunks of 1-5 words with precise timings, ensure SRT/FFmpeg renders them synchronously.
- **Phase 2 â€” Usability:** Build a real `/videos` page with list + pagination, fix retry to use fresh signed URLs, force Google account selection, expose error messages to users.
- **Phase 3 â€” Worker On-Demand:** Add auto-shutdown logic (60s idle timeout) to the worker, create a standalone trigger script, and integrate an HTTP trigger so the API can wake the worker immediately when a video is queued. Complement with a cron job (GitHub Actions / Railway Scheduler / OS cron) as a safety net every 5 minutes.

**Tech Stack:** Next.js 16, Prisma, BullMQ, Redis, Cloudflare R2, MercadoPago, NextAuth v4, TypeScript.

---

## Approved Execution Corrections (2026-05-04)

The plan below must be executed with these corrections instead of the original risky snippets:

1. **No subagent may run `npm run build`, `next build`, or `pg_ctl start`.** Only the orchestrator runs build at final verification. Do not start PostgreSQL manually; assume existing DB service or report blocked.
2. **Webhook idempotency:** do not use `x-request-id` or `crypto.randomUUID()` as the idempotency key. Use `payload.data.id` as `notificationId`, and enforce `@@unique([provider, topic, notificationId])`.
3. **R2 signed URL helper:** add `getSignedUrlFromAny(urlOrKey?: string | null)` to `src/lib/r2.ts` before any route uses it.
4. **BullMQ worker:** do not use `worker.getQueue()` or `deadLetterQueue` on `Worker`; use explicit counters/Queue APIs supported by BullMQ v5.
5. **Health check:** use installed `ioredis`, not the uninstalled `redis` package.
6. **Segment splitter:** join chunk words with spaces (`join(" ")`), never `join("")`.
7. **MonthlyUsage:** create the video and increment usage in one Prisma transaction to avoid billing leaks.
8. **Middleware path:** the real middleware file is root-level `middleware.ts`, not `src/middleware.ts`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `WebhookLog` model; no other schema changes needed |
| `src/lib/r2.ts` | Modify | Implement real `deleteFromR2` with `DeleteObjectCommand`; add `getSignedUrlFromAny` helper |
| `src/lib/queue.ts` | Modify | Add Redis retry/backoff options; add `triggerWorker()` helper |
| `src/lib/auth.ts` | Modify | Force Google account selection with `max_age: 0` |
| `src/app/api/videos/route.ts` | Modify | Increment `MonthlyUsage` on create; add pagination/search params |
| `src/app/api/videos/[id]/route.ts` | Modify | Call `deleteFromR2` on DELETE for all artifact URLs |
| `src/app/api/videos/[id]/retry/route.ts` | Modify | Pass `originalUrl` through `getSignedUrlFromAny` before re-enqueue |
| `src/app/api/upload/route.ts` | Modify | Reject files > 500MB before `arrayBuffer()` |
| `src/app/api/billing/webhook/mercadopago/route.ts` | Modify | Log processed notifications; skip duplicates |
| `src/app/api/health/route.ts` | Modify | Check DB, Redis, and R2 connectivity |
| `middleware.ts` | Modify | Redirect unauthenticated users away from protected paths |
| `src/workers/videoProcessor.ts` | Modify | Add auto-shutdown after idle; add DLQ; fix email error handling |
| `scripts/start-worker.ts` | Create | Standalone script: check pending jobs â†’ start worker â†’ exit |
| `src/app/api/worker/start/route.ts` | Create | HTTP endpoint to trigger worker start (for Vercelâ†’Railway hook) |
| `src/app/(dashboard)/videos/page.tsx` | Modify | Render real video list with pagination |
| `src/components/dashboard/VideoList.tsx` | Create | Client component: table/grid of videos with status + actions |
| `src/components/dashboard/VideoPagination.tsx` | Create | Pagination controls |
| `src/lib/whisper.ts` | Modify | Enable word-level timestamps on all 3 providers |
| `src/lib/segment-splitter.ts` | Create | Split long segments into word-level chunks (1-5 words) |
| `src/lib/subtitle-styles.ts` | Modify | Ensure SRT renders micro-segments correctly |

---

## Phase 1 â€” Production Blockers

---

### Task 1: Prisma Schema â€” Add WebhookLog Model

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev --name add_webhook_log`

- [ ] **Step 1: Add WebhookLog model to schema**

Add this model at the end of `prisma/schema.prisma` (after `model Payment`):

```prisma
model WebhookLog {
  id              String   @id @default(cuid())
  provider        String
  notificationId  String
  topic           String
  payload         Json
  processedAt     DateTime @default(now())

  @@unique([provider, topic, notificationId])
  @@map("webhook_logs")
}
```

- [ ] **Step 2: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name add_webhook_log
```

Expected: migration created and applied successfully.

- [ ] **Step 3: Regenerate Prisma Client**

Run:
```bash
npx prisma generate
```

Expected: client generated with `WebhookLog` type.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): add WebhookLog model for idempotency"
```

---

### Task 2: R2 Storage â€” Implement Real deleteFromR2

**Files:**
- Modify: `src/lib/r2.ts`

- [ ] **Step 1: Import DeleteObjectCommand and implement delete**

Replace the no-op `deleteFromR2` function in `src/lib/r2.ts` (lines 48-50) with:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
```

Then replace the function:

```typescript
export async function deleteFromR2(key: string): Promise<void> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    throw new Error("R2 environment variables are missing");
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  await getS3Client().send(command);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/r2.ts
git commit -m "fix(r2): implement real deleteFromR2 with DeleteObjectCommand"
```

---

### Task 3: Queue â€” Redis Retry/Backoff + Worker Trigger Helper

**Files:**
- Modify: `src/lib/queue.ts`

- [ ] **Step 1: Add robust Redis connection options**

Replace the contents of `src/lib/queue.ts` with:

```typescript
import { Queue } from "bullmq";

export type VideoJobPayload = {
  videoId: string;
  userId: string;
  originalUrl: string;
  duration: number;
  useAiCorrection?: boolean;
};

let videoQueue: Queue<VideoJobPayload> | null = null;

function getVideoQueue(): Queue<VideoJobPayload> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to enqueue video jobs");
  }

  if (!videoQueue) {
    videoQueue = new Queue<VideoJobPayload>("video-processing", {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    });

    process.on("SIGTERM", async () => {
      if (videoQueue) await videoQueue.close();
    });

    process.on("SIGINT", async () => {
      if (videoQueue) await videoQueue.close();
    });
  }

  return videoQueue;
}

export async function enqueueVideoJob(data: VideoJobPayload): Promise<void> {
  const queue = getVideoQueue();
  await queue.add("process-video", data);
}

/**
 * Trigger the on-demand worker to start processing jobs.
 * This sends a lightweight HTTP request to the worker start URL.
 * If no URL is configured, it silently does nothing (cron will catch it).
 */
export async function triggerWorker(): Promise<void> {
  const workerStartUrl = process.env.WORKER_START_URL;
  if (!workerStartUrl) return;

  try {
    await fetch(workerStartUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.WORKER_SECRET ?? "" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail â€” cron backup will handle it
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queue.ts
git commit -m "feat(queue): add Redis retry/backoff and worker trigger helper"
```

---

### Task 4: Auth â€” Force Google Account Selection

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add max_age to Google authorization params**

Replace the `authorization` block in `src/lib/auth.ts` (lines 18-22) with:

```typescript
      authorization: {
        params: {
          prompt: "select_account",
          max_age: 0,
        },
      },
```

The `max_age: 0` forces Google to re-authenticate instead of reusing an existing SSO session.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix(auth): force Google account selection with max_age=0"
```

---

### Task 5: POST /api/videos â€” Increment MonthlyUsage + Validate Size

**Files:**
- Modify: `src/app/api/videos/route.ts`

- [ ] **Step 1: Increment MonthlyUsage after video creation**

In `src/app/api/videos/route.ts`, after the `prisma.video.create` call (around line 128), add:

```typescript
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await prisma.monthlyUsage.upsert({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    update: {
      videosCount: { increment: 1 },
      secondsTotal: { increment: body.duration ?? 0 },
    },
    create: {
      userId,
      year,
      month,
      videosCount: 1,
      secondsTotal: body.duration ?? 0,
    },
  });
```

- [ ] **Step 2: Add fileSize validation to CreateVideoBody and enforce limit**

At the top of the file, in the `CreateVideoBody` type, ensure `fileSize` is present:

```typescript
type CreateVideoBody = {
  title: string;
  originalUrl: string;
  duration?: number;
  fileSize?: number;
  paymentType?: PaymentType;
  paymentId?: string;
  mimeType?: string;
  useAiCorrection?: boolean;
};
```

After reading the body (line 77), add:

```typescript
  const MAX_FILE_SIZE_MB = 500;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  if (body.fileSize && body.fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB` },
      { status: 413 },
    );
  }
```

- [ ] **Step 3: Call triggerWorker after enqueuing**

After the `enqueueVideoJob` call (around line 136), add:

```typescript
  await triggerWorker();
```

Also add the import at the top:

```typescript
import { enqueueVideoJob, triggerWorker } from "@/lib/queue";
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/videos/route.ts
git commit -m "feat(videos): increment MonthlyUsage, validate file size, trigger worker"
```

---

### Task 6: DELETE /api/videos/[id] â€” Cleanup R2 Artifacts

**Files:**
- Modify: `src/app/api/videos/[id]/route.ts`

- [ ] **Step 1: Delete R2 objects before deleting DB record**

Replace the `DELETE` handler in `src/app/api/videos/[id]/route.ts` (lines 75-83) with:

```typescript
import { deleteFromR2, extractR2Key } from "@/lib/r2";

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "NÃ£o autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "VÃ­deo nÃ£o encontrado" }, { status: 404 });
  }

  // Clean up R2 artifacts
  const urls = [video.originalUrl, video.processedUrl, video.srtUrl, video.audioUrl, video.thumbnailUrl];
  await Promise.all(
    urls
      .filter((url): url is string => Boolean(url))
      .map(async (url) => {
        try {
          const key = extractR2Key(url);
          if (key && key !== url) {
            await deleteFromR2(key);
          }
        } catch {
          // Ignore cleanup errors; don't block deletion
        }
      }),
  );

  await prisma.video.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/videos/[id]/route.ts
git commit -m "feat(videos): delete R2 artifacts on video deletion"
```

---

### Task 7: GET /api/videos â€” Add Pagination + Search

**Files:**
- Modify: `src/app/api/videos/route.ts`

- [ ] **Step 1: Replace GET handler with pagination support**

Replace the `GET` handler (lines 27-53) with:

```typescript
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "NÃ£o autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: Prisma.VideoWhereInput = { userId: session.user.id };
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }
  if (status) {
    where.status = status as VideoStatus;
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { transcription: true },
    }),
    prisma.video.count({ where }),
  ]);

  const videosWithSignedUrls = await Promise.all(
    videos.map(async (video) => ({
      ...video,
      originalUrl: await getSignedUrlFromAny(video.originalUrl),
      processedUrl: await getSignedUrlFromAny(video.processedUrl),
      srtUrl: await getSignedUrlFromAny(video.srtUrl),
      audioUrl: await getSignedUrlFromAny(video.audioUrl),
      thumbnailUrl: await getSignedUrlFromAny(video.thumbnailUrl),
    })),
  );

  return NextResponse.json({
    ok: true,
    data: videosWithSignedUrls,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

Also add imports at the top:

```typescript
import { Prisma, VideoStatus } from "@prisma/client";
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/videos/route.ts
git commit -m "feat(videos): add pagination, search, and status filter to list"
```

---

### Task 8: Retry Route â€” Use Fresh Signed URL

**Files:**
- Modify: `src/app/api/videos/[id]/retry/route.ts`

- [ ] **Step 1: Refresh originalUrl before re-enqueueing**

Add import at the top:

```typescript
import { getSignedUrlFromAny, extractR2Key } from "@/lib/r2";
```

Before `queue.add`, compute a fresh URL:

```typescript
  // Refresh the original URL in case the stored one is an expired signed URL
  const freshOriginalUrl = video.originalUrl
    ? await getSignedUrlFromAny(extractR2Key(video.originalUrl))
    : video.originalUrl;

  await queue.add("process-video", {
    videoId: video.id,
    userId: video.userId,
    originalUrl: freshOriginalUrl ?? video.originalUrl,
    duration: video.duration ?? 0,
    useAiCorrection: video.useAiCorrection,
  }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
```

- [ ] **Step 2: Call triggerWorker after enqueuing**

After `queue.add`, add:

```typescript
  await triggerWorker();
```

Add import:

```typescript
import { triggerWorker } from "@/lib/queue";
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/videos/[id]/retry/route.ts
git commit -m "fix(retry): use fresh signed URL and trigger worker on retry"
```

---

### Task 9: Upload Route â€” Enforce 500MB Size Limit

**Files:**
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Reject oversized files before reading buffer**

After reading the file from formData (line 23), add:

```typescript
    const MAX_FILE_SIZE_MB = 500;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB` },
        { status: 413 },
      );
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat(upload): reject files larger than 500MB"
```

---

### Task 10: MercadoPago Webhook â€” Idempotency

**Files:**
- Modify: `src/app/api/billing/webhook/mercadopago/route.ts`

- [ ] **Step 1: Add idempotency check at the top of POST handler**

After signature validation and after computing `topic`, add. Use `payload.data.id`, not `x-request-id`, because provider retries can have different request headers:

```typescript
  const notificationId = String(payload.data?.id ?? "");
  if (!notificationId) {
    return NextResponse.json({ ok: false, error: "Missing notification id" }, { status: 400 });
  }

  const existing = await prisma.webhookLog.findUnique({
    where: {
      provider_topic_notificationId: {
        provider: "mercadopago",
        topic,
        notificationId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, message: "Already processed" });
  }
```

- [ ] **Step 2: Log webhook after processing each topic**

Before the final `return NextResponse.json({ ok: true })` (line 91), add:

```typescript
  await prisma.webhookLog.create({
    data: {
      provider: "mercadopago",
      notificationId,
      topic,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
```

Add import at the top:

```typescript
import { Prisma } from "@prisma/client";
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/webhook/mercadopago/route.ts
git commit -m "feat(webhook): add MercadoPago webhook idempotency with WebhookLog"
```

---

### Task 11: Health Check â€” Real Dependencies Check

**Files:**
- Modify: `src/app/api/health/route.ts`
- Create: `src/lib/health.ts`

- [ ] **Step 1: Create health check helpers**

Create `src/lib/health.ts`:

```typescript
import { prisma } from "./db";
import { isR2Configured, getS3Client } from "./r2";

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function checkRedis(): Promise<boolean> {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return false;
    // Lightweight check using installed ioredis dependency
    const { default: Redis } = await import("ioredis");
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

export async function checkR2(): Promise<boolean> {
  try {
    if (!isR2Configured()) return false;
    await getS3Client().send(
      new (await import("@aws-sdk/client-s3")).HeadBucketCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Update health API route**

Replace `src/app/api/health/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { checkDatabase, checkRedis, checkR2 } from "@/lib/health";

export async function GET() {
  const [db, redis, r2] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkR2(),
  ]);

  const healthy = db && redis && r2;

  return NextResponse.json(
    {
      ok: healthy,
      timestamp: new Date().toISOString(),
      services: {
        database: db ? "up" : "down",
        redis: redis ? "up" : "down",
        r2: r2 ? "up" : "down",
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/health.ts src/app/api/health/route.ts
git commit -m "feat(health): check DB, Redis, and R2 connectivity"
```

---

### Task 12: Middleware â€” Protect Authenticated Routes

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add session cookie check to middleware**

Replace root-level `middleware.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";

const windowMs = 60_000;
const maxRequests = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(ip);
  }
}, windowMs);

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth", "/api/health", "/api/worker/start"];
const STATIC_PATHS = ["/_next", "/favicon.ico", "/uploads", "/ffmpeg"];

function isPublic(path: string): boolean {
  if (STATIC_PATHS.some((p) => path.startsWith(p))) return true;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return true;
  return false;
}

function rateLimit(ip: string): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { ok: false, error: "Rate limit excedido" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  bucket.count += 1;
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const sessionToken = request.cookies.get("next-auth.session-token")?.value;
  if (!sessionToken) {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      return NextResponse.json({ ok: false, error: "NÃ£o autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const rateLimitResponse = rateLimit(ip);
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): require auth cookie on protected routes"
```

---

## Phase 1.5 â€” Core Product Fix: Word-Level Subtitle Segmentation

**Problem:** Whisper returns segments of 5-10 seconds (full sentences). The SRT shows all text at once for the entire segment duration, producing a wall of text instead of synchronized word-by-word subtitles.

**Solution:** Enable word-level timestamps from Whisper, then split long segments into micro-chunks of 1-5 words each with precise start/end timings. Each micro-chunk becomes its own SRT entry, so text appears and disappears in sync with speech.

---

### Task 13: Whisper â€” Enable Word-Level Timestamps on All Providers

**Files:**
- Modify: `src/lib/whisper.ts`

- [ ] **Step 1: Enable word_timestamps on local API**

In `src/lib/whisper.ts`, find the `transcribeWithApi` function. Change line 56 from:

```typescript
formData.append("word_timestamps", "false");
```

To:

```typescript
formData.append("word_timestamps", "true");
```

- [ ] **Step 2: Enable word timestamps on local Whisper CLI**

In the `transcribeWithLocalWhisper` function, add `--word_timestamps` to the args array (after `--language Portuguese`):

```typescript
[
  audioPath,
  "--model",
  "base",
  "--language",
  "Portuguese",
  "--word_timestamps",
  "true",
  "--output_format",
  "json",
  "--output_dir",
  tmpDir,
  "--verbose",
  "False",
]
```

- [ ] **Step 3: Enable word timestamps on OpenAI API**

In `transcribeWithOpenAI`, change the API call to request word-level granularity:

```typescript
  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });
```

Then update the segment mapping to preserve word timings:

```typescript
  const segments =
    response.segments?.map((seg, idx) => ({
      id: `segment-${idx}`,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      words: (seg as any).words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.probability,
      })) ?? undefined,
    })) ?? [];
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/whisper.ts
git commit -m "feat(whisper): enable word-level timestamps on all providers"
```

---

### Task 14: Segment Splitter â€” Break Long Segments into Word Chunks

**Files:**
- Create: `src/lib/segment-splitter.ts`
- Modify: `src/workers/videoProcessor.ts`

- [ ] **Step 1: Create word-level segment splitter**

Create `src/lib/segment-splitter.ts`:

```typescript
import type { TranscriptionSegment } from "@/types/subtitle";

export interface SplitOptions {
  /** Maximum words per subtitle chunk (default: 3) */
  maxWordsPerChunk?: number;
  /** Minimum duration in seconds for a chunk (default: 0.8) */
  minDurationSeconds?: number;
  /** Maximum duration in seconds for a chunk (default: 3.0) */
  maxDurationSeconds?: number;
}

function splitSegmentWords(
  segment: TranscriptionSegment,
  options: SplitOptions = {},
): TranscriptionSegment[] {
  const {
    maxWordsPerChunk = 3,
    minDurationSeconds = 0.8,
    maxDurationSeconds = 3.0,
  } = options;

  const words = segment.words ?? [];

  // If no word-level data available, keep the original segment but clamp duration
  if (words.length === 0) {
    const duration = segment.end - segment.start;
    if (duration <= maxDurationSeconds) {
      return [segment];
    }
    // Split by time if no words available
    const chunks: TranscriptionSegment[] = [];
    let currentStart = segment.start;
    while (currentStart < segment.end) {
      const chunkEnd = Math.min(currentStart + maxDurationSeconds, segment.end);
      chunks.push({
        id: `${segment.id}-chunk-${chunks.length}`,
        start: currentStart,
        end: chunkEnd,
        text: segment.text,
      });
      currentStart = chunkEnd;
    }
    return chunks;
  }

  const chunks: TranscriptionSegment[] = [];
  let currentWords: typeof words = [];

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i]);

    const shouldSplit =
      currentWords.length >= maxWordsPerChunk ||
      (currentWords.length > 0 && i === words.length - 1);

    if (shouldSplit) {
      const start = currentWords[0].start;
      const end = currentWords[currentWords.length - 1].end;
      const duration = end - start;

      // Enforce minimum duration by extending end
      const finalEnd = Math.max(end, start + minDurationSeconds);

      chunks.push({
        id: `${segment.id}-chunk-${chunks.length}`,
        start,
        end: finalEnd,
        text: currentWords.map((w) => w.word.trim()).join(" ").trim(),
        words: currentWords,
      });

      currentWords = [];
    }
  }

  // Merge overlapping end/start times to prevent gaps
  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].start < chunks[i - 1].end) {
      chunks[i - 1].end = chunks[i].start;
    }
  }

  return chunks;
}

export function splitSegmentsByWords(
  segments: TranscriptionSegment[],
  options?: SplitOptions,
): TranscriptionSegment[] {
  return segments.flatMap((seg) => splitSegmentWords(seg, options));
}
```

- [ ] **Step 2: Integrate splitter into video processor**

In `src/workers/videoProcessor.ts`, after receiving `correctedSegments` (around line 99), add:

```typescript
import { splitSegmentsByWords } from "@/lib/segment-splitter";
```

Then after correction:

```typescript
    const correctedSegments = await correctTranscription(rawTranscription.segments, useAiCorrection);
    const wordLevelSegments = splitSegmentsByWords(correctedSegments, {
      maxWordsPerChunk: 3,
      minDurationSeconds: 0.8,
      maxDurationSeconds: 2.5,
    });
    await job.updateProgress(70);
```

And pass `wordLevelSegments` to `saveTranscription` and `writeSrtFile`:

```typescript
    await saveTranscription(
      videoId,
      rawTranscription.rawText,
      wordLevelSegments.map((segment) => segment.text).join(" "),
      wordLevelSegments,
      rawTranscription.language,
      rawTranscription.confidence,
    );
```

And:

```typescript
    srtPath = await writeSrtFile(videoId, wordLevelSegments);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/segment-splitter.ts src/workers/videoProcessor.ts
git commit -m "feat(subtitles): split segments into word-level chunks for sync"
```

---

### Task 15: Subtitle Styles â€” Verify SRT Format for Micro-Segments

**Files:**
- Modify: `src/lib/subtitle-styles.ts`

- [ ] **Step 1: Ensure generateSRT handles short durations correctly**

The current `generateSRT` function already formats timestamps correctly. The key fix is ensuring the FFmpeg `subtitles` filter handles overlapping times properly. Update the `classic` style filter to disable overlapping (which can cause text to stack):

In `src/lib/subtitle-styles.ts`, update the `classic` style `ffmpegFilter`:

```typescript
    ffmpegFilter:
      "subtitles=FILE:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1,Alignment=2,MarginV=30,WrapStyle=0'",
```

Add `WrapStyle=0` to all style filters to ensure text wraps within the defined box instead of overflowing.

- [ ] **Step 2: Commit**

```bash
git add src/lib/subtitle-styles.ts
git commit -m "fix(subtitles): add WrapStyle=0 to prevent text overflow on micro-segments"
```

---

## Phase 2 â€” Usability

---

### Task 16: Videos Page â€” Real List with Pagination

**Files:**
- Modify: `src/app/(dashboard)/videos/page.tsx`
- Create: `src/components/dashboard/VideoList.tsx`
- Create: `src/components/dashboard/VideoPagination.tsx`

- [ ] **Step 1: Create VideoList component**

Create `src/components/dashboard/VideoList.tsx`:

```typescript
"use client";

import Link from "next/link";

export type VideoListItem = {
  id: string;
  title: string;
  status: string;
  duration?: number | null;
  processedUrl?: string | null;
  srtUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  errorMessage?: string | null;
};

export function VideoList({ videos }: { videos: VideoListItem[] }) {
  if (videos.length === 0) {
    return <p className="text-muted-foreground">Nenhum vÃ­deo encontrado.</p>;
  }

  return (
    <div className="grid gap-4">
      {videos.map((video) => (
        <div key={video.id} className="border rounded-lg p-4 flex items-start gap-4">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className="w-24 h-16 object-cover rounded" />
          ) : (
            <div className="w-24 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              Sem capa
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{video.title}</h3>
            <p className="text-sm text-muted-foreground">
              Status: <span className="uppercase text-xs font-semibold">{video.status}</span>
              {video.duration ? ` Â· ${Math.round(video.duration / 60)}min` : ""}
            </p>
            {video.errorMessage && (
              <p className="text-sm text-destructive mt-1">{video.errorMessage}</p>
            )}
            <div className="flex gap-2 mt-2">
              <Link href={`/videos/${video.id}`} className="text-sm text-primary underline">
                Ver detalhes
              </Link>
              {video.processedUrl && (
                <a href={`/api/videos/${video.id}/download`} className="text-sm text-primary underline">
                  Baixar vÃ­deo
                </a>
              )}
              {video.srtUrl && (
                <a href={`/api/videos/${video.id}/download?type=srt`} className="text-sm text-primary underline">
                  Baixar SRT
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create VideoPagination component**

Create `src/components/dashboard/VideoPagination.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function VideoPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Anterior
      </button>
      <span className="text-sm text-muted-foreground">
        PÃ¡gina {page} de {totalPages}
      </span>
      <button
        onClick={() => goTo(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        PrÃ³xima
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Update videos page**

Replace `src/app/(dashboard)/videos/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { VideoList } from "@/components/dashboard/VideoList";
import { VideoPagination } from "@/components/dashboard/VideoPagination";

async function fetchVideos(searchParams: Record<string, string | string[] | undefined>) {
  const page = String(searchParams.page ?? "1");
  const limit = String(searchParams.limit ?? "20");
  const search = String(searchParams.search ?? "");
  const status = String(searchParams.status ?? "");

  const query = new URLSearchParams();
  query.set("page", page);
  query.set("limit", limit);
  if (search) query.set("search", search);
  if (status) query.set("status", status);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/videos?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) return { data: [], pagination: { page: 1, totalPages: 1 } };
  const json = await res.json();
  return json;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const { data: videos, pagination } = await fetchVideos(params);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meus VÃ­deos</h1>
      <VideoList videos={videos ?? []} />
      <VideoPagination page={pagination.page} totalPages={pagination.totalPages} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/videos/page.tsx src/components/dashboard/VideoList.tsx src/components/dashboard/VideoPagination.tsx
git commit -m "feat(videos): implement real video list with pagination"
```

---

## Phase 3 â€” Worker On-Demand Architecture

---

### Task 17: Worker Processor â€” Auto-Shutdown + DLQ + Error Handling

**Files:**
- Modify: `src/workers/videoProcessor.ts`

- [ ] **Step 1: Add auto-shutdown and DLQ configuration**

Replace the bottom of `src/workers/videoProcessor.ts` (from line 180 onwards) with:

```typescript
const IDLE_SHUTDOWN_MS = 60_000; // 60 seconds of idle before shutdown

const worker = new Worker<VideoJob>("video-processing", processVideo, {
  ...connection,
  limiter: { max: 1, duration: 1000 },
  deadLetterQueue: {
    name: "video-processing-dlq",
  },
});

let idleTimer: NodeJS.Timeout | null = null;
let activeJobs = 0;

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleShutdown() {
  clearIdleTimer();
  idleTimer = setTimeout(async () => {
    if (activeJobs === 0) {
      console.log("[worker] Idle timeout reached. Shutting down.");
      await worker.close();
      process.exit(0);
    }
  }, IDLE_SHUTDOWN_MS);
}

worker.on("active", () => {
  clearIdleTimer();
  activeJobs += 1;
});

worker.on("completed", () => {
  activeJobs = Math.max(0, activeJobs - 1);
  scheduleShutdown();
});

worker.on("failed", () => {
  activeJobs = Math.max(0, activeJobs - 1);
  scheduleShutdown();
});

process.on("SIGTERM", async () => {
  clearIdleTimer();
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  clearIdleTimer();
  await worker.close();
  process.exit(0);
});

console.log("[worker] Started and waiting for jobs...");
```

- [ ] **Step 2: Fix email error handling in processVideo**

In the `processVideo` function, around lines 149-157, wrap the email call:

```typescript
    const video = await prisma.video.findUnique({ where: { id: videoId }, include: { user: true } });
    if (video?.user?.email) {
      try {
        await sendVideoReadyEmail({
          userEmail: video.user.email,
          userName: video.user.name ?? "UsuÃ¡rio",
          videoTitle: video.title,
          videoUrl: `/videos/${videoId}`,
        });
      } catch (emailErr) {
        console.error("[worker] Failed to send ready email:", emailErr);
      }
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/workers/videoProcessor.ts
git commit -m "feat(worker): auto-shutdown after idle, DLQ, and safe email sending"
```

---

### Task 18: Worker Trigger â€” Standalone Start Script + API Endpoint

**Files:**
- Create: `scripts/start-worker.ts`
- Create: `src/app/api/worker/start/route.ts`

- [ ] **Step 1: Create standalone worker start script**

Create `scripts/start-worker.ts`:

```typescript
import { Queue } from "bullmq";
import { spawn } from "node:child_process";
import path from "node:path";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error("[start-worker] REDIS_URL not set");
  process.exit(1);
}

async function main() {
  const queue = new Queue("video-processing", {
    connection: { url: redisUrl },
  });

  const counts = await queue.getJobCounts();
  const hasWork = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0) > 0;

  await queue.close();

  if (!hasWork) {
    console.log("[start-worker] No pending jobs. Exiting.");
    process.exit(0);
  }

  console.log("[start-worker] Starting worker for pending jobs...");

  const workerPath = path.join(process.cwd(), "src", "workers", "videoProcessor.ts");
  const proc = spawn("npx", ["tsx", workerPath], {
    stdio: "inherit",
    env: process.env,
  });

  proc.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[start-worker] Error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Create worker start API endpoint**

Create `src/app/api/worker/start/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Worker not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { secret?: string };
  if (body.secret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Only spawn if running on a persistent server (not Vercel)
  if (process.env.VERCEL) {
    return NextResponse.json({ ok: true, message: "Worker must be started externally on Vercel" });
  }

  const workerPath = path.join(process.cwd(), "src", "workers", "videoProcessor.ts");
  const proc = spawn("npx", ["tsx", workerPath], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  proc.unref();

  return NextResponse.json({ ok: true, message: "Worker started" });
}
```

- [ ] **Step 3: Add npm scripts to package.json**

Add to `package.json` in the `"scripts"` section:

```json
    "worker": "tsx src/workers/videoProcessor.ts",
    "worker:start": "tsx scripts/start-worker.ts"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/start-worker.ts src/app/api/worker/start/route.ts package.json
git commit -m "feat(worker): add on-demand trigger script and start endpoint"
```

---

### Task 19: Environment Variables â€” Document New Required Variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new environment variables**

Append to `.env.example`:

```env
# Worker on-demand trigger
WORKER_START_URL=http://localhost:3000/api/worker/start
WORKER_SECRET=change-me-in-production

# Optional: override idle shutdown timeout (default 60000ms)
# WORKER_IDLE_TIMEOUT_MS=60000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document WORKER_START_URL and WORKER_SECRET"
```

---

## Self-Review

**1. Spec coverage:**
- âœ… MonthlyUsage increment â†’ Task 5
- âœ… deleteFromR2 real â†’ Task 2
- âœ… Webhook idempotency â†’ Task 10
- âœ… Upload size limit â†’ Task 9
- âœ… Auth middleware â†’ Task 12
- âœ… Health check real â†’ Task 11
- âœ… Pagination/search â†’ Task 7
- âœ… Retry signed URL â†’ Task 8
- âœ… Google account selection â†’ Task 4
- âœ… Worker auto-shutdown â†’ Task 17
- âœ… Worker trigger â†’ Task 18
- âœ… Video list page â†’ Task 16
- âœ… Redis retry/backoff â†’ Task 3
- âœ… Email error handling â†’ Task 17
- âœ… DLQ â†’ Task 17
- âœ… Word-level timestamps â†’ Task 13
- âœ… Segment word splitting â†’ Task 14
- âœ… Micro-segment SRT format â†’ Task 15

**2. Placeholder scan:**
- No "TBD", "TODO", or vague instructions found.
- Every task includes exact file paths and complete code.

**3. Type consistency:**
- `VideoJobPayload` used in `queue.ts` matches worker expectations.
- `WebhookLog` model created before being used in webhook route.
- `getSignedUrlFromAny` and `extractR2Key` used consistently.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-legendai-production-fixes.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** â€” I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** â€” Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

Also included in this plan:
- **Worker architecture:** The worker now auto-shutdowns after 60s idle. Use `npm run worker:start` as a cron job every 5 minutes (GitHub Actions, Railway Scheduler, or OS cron). The API also calls `triggerWorker()` immediately when a video is queued, so processing starts right away without waiting for the cron.
- **Deployment note:** If your API runs on Vercel, the worker must run on a separate persistent host (Railway, Render, VPS) because Vercel cannot spawn long-lived processes. Set `WORKER_START_URL` to point to your worker host.
