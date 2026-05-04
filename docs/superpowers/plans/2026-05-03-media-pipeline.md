# Media Pipeline Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan.

**Goal:** Replace all stubs in ffmpeg.ts, r2.ts, upload, and export with real implementations so the flow upload→transcribe→burn→download works end-to-end.

**Architecture:** All processing runs server-side via BullMQ workers. FFmpeg CLI handles audio extraction + subtitle burning. Whisper CLI handles transcription. R2 SDK handles storage. Upload API receives files and pushes to R2.

**Tech Stack:** `@aws-sdk/client-s3`, `ffmpeg` CLI, `Whisper` CLI, BullMQ, Next.js Route Handlers

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install AWS SDK for R2**

Run: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

Expected: packages added to `package.json` + `node_modules`

- [ ] **Step 2: Verify ffmpeg is available**

Run: `where ffmpeg`

Expected: `C:\tools\ffmpeg\ffmpeg.exe` or similar

---

### Task 2: Rewrite r2.ts — real R2 SDK

**Files:**
- Rewrite: `src/lib/r2.ts`

Replace stubs with real AWS SDK v3 calls targeting Cloudflare R2 (S3-compatible).

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME ?? "legendaai-videos";
}

function getPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL ?? "";
  return `${base}/${key}`;
}

export async function uploadBufferToR2(
  buffer: Uint8Array,
  key: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await getR2Client().send(command);
  return getPublicUrl(key);
}

export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  await getR2Client().send(command);
}
```

- [ ] **Step 1: Write src/lib/r2.ts with full R2 SDK**

Replace entire file content with above code.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in r2.ts

---

### Task 3: Rewrite ffmpeg.ts — real ffmpeg CLI

**Files:**
- Rewrite: `src/lib/ffmpeg.ts`

Replace all stubs with real `child_process.execFile` calls to ffmpeg CLI.

```typescript
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleStyleId } from "./subtitle-styles";
import { SUBTITLE_STYLES } from "./subtitle-styles";
import { uploadBufferToR2 } from "./r2";

function ffmpeg(args: string[], timeout = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
}

export async function extractAudio(videoPath: string): Promise<string> {
  const audioPath = videoPath.replace(/\.[^.]+$/, ".wav");
  await ffmpeg([
    "-i", videoPath,
    "-vn",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    audioPath,
  ]);
  return audioPath;
}

export async function extractThumbnail(videoPath: string): Promise<string> {
  const thumbnailPath = videoPath.replace(/\.[^.]+$/, ".jpg");
  await ffmpeg([
    "-i", videoPath,
    "-ss", "00:00:01",
    "-vframes", "1",
    thumbnailPath,
  ]);
  return thumbnailPath;
}

export async function cleanup(files: string[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try { await fs.unlink(file); } catch { /* ignore */ }
    }),
  );
}

export async function downloadFromR2(url: string): Promise<string> {
  const filename = path.basename(new URL(url).pathname) || `video-${Date.now()}.mp4`;
  const localPath = path.join(process.cwd(), "tmp", filename);
  await fs.mkdir(path.dirname(localPath), { recursive: true });

  // Download via fetch from public R2 URL
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download from R2: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);
  return localPath;
}

export async function uploadToR2(filePath: string, key: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath);
  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".jpg": "image/jpeg",
    ".srt": "application/x-subrip",
    ".vtt": "text/vtt",
  };
  return uploadBufferToR2(new Uint8Array(buffer), key, mimeMap[ext] ?? "application/octet-stream");
}

export async function applySubtitleStyle(
  videoPath: string,
  srtPath: string,
  styleId: SubtitleStyleId,
  outputPath: string,
): Promise<string> {
  const style = SUBTITLE_STYLES[styleId];
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const filter = `subtitles='${escapedSrt}':force_style='${style.ffmpegFilter.split("FILE:")[1]}'`;

  await ffmpeg([
    "-i", videoPath,
    "-vf", filter,
    "-c:a", "copy",
    "-movflags", "+faststart",
    outputPath,
  ]);

  return outputPath;
}
```

- [ ] **Step 1: Write src/lib/ffmpeg.ts with real ffmpeg CLI calls**
- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in ffmpeg.ts

---

### Task 4: Create upload API route

**Files:**
- Create: `src/app/api/upload/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadBufferToR2 } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".mp4";
  const key = `videos/${session.user.id}/${uuidv4()}${ext}`;

  const url = await uploadBufferToR2(new Uint8Array(buffer), key, file.type);

  return NextResponse.json({
    ok: true,
    data: {
      url,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
    },
  });
}
```

Need to install uuid if not present: `npm install uuid @types/uuid`

- [ ] **Step 1: Create src/app/api/upload/route.ts**
- [ ] **Step 2: Verify TypeScript compiles**

---

### Task 5: Create download API route

**Files:**
- Create: `src/app/api/videos/[id]/download/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!video) {
    return NextResponse.json({ ok: false, error: "Vídeo não encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(_request.url);
  const type = searchParams.get("type") ?? "video";

  if (type === "srt") {
    const transcription = await prisma.transcription.findUnique({ where: { videoId: id } });
    const { generateSRT } = await import("@/lib/subtitle-styles");
    const segments = transcription?.segments as any[] ?? [];
    const srt = generateSRT(segments);
    return new NextResponse(srt, {
      headers: {
        "Content-Type": "application/x-subrip",
        "Content-Disposition": `attachment; filename="${video.title || "legenda"}.srt"`,
      },
    });
  }

  if (!video.processedUrl) {
    return NextResponse.json({ ok: false, error: "Vídeo processado indisponível" }, { status: 404 });
  }

  return NextResponse.redirect(video.processedUrl);
}
```

- [ ] **Step 1: Create src/app/api/videos/[id]/download/route.ts**
- [ ] **Step 2: Verify TypeScript compiles**

---

### Task 6: Implement exportWorker.ts — burn-in worker

**Files:**
- Rewrite: `src/workers/exportWorker.ts`

```typescript
import { Worker, type Job } from "bullmq";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { downloadFromR2, applySubtitleStyle, uploadToR2, cleanup } from "@/lib/ffmpeg";
import { generateSRT } from "@/lib/subtitle-styles";
import type { SubtitleStyleId } from "@/lib/subtitle-styles";

interface ExportJob {
  videoId: string;
  styleId?: SubtitleStyleId;
}

const connection = process.env.REDIS_URL
  ? { connection: { url: process.env.REDIS_URL } }
  : undefined;

async function processExport(job: Job<ExportJob>) {
  const { videoId, styleId = "classic" } = job.data;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { transcription: true },
  });

  if (!video?.transcription) throw new Error("Vídeo ou transcrição não encontrados");
  if (!video.processedUrl && !video.originalUrl) throw new Error("Nenhum vídeo fonte disponível");

  const sourceUrl = video.processedUrl ?? video.originalUrl!;
  const videoPath = await downloadFromR2(sourceUrl);
  await job.updateProgress(20);

  const segments = Array.isArray(video.transcription.segments)
    ? (video.transcription.segments as any[])
    : [];

  const srtContent = generateSRT(segments);
  const srtPath = path.join(process.cwd(), "tmp", `${videoId}.srt`);
  await fs.mkdir(path.dirname(srtPath), { recursive: true });
  await fs.writeFile(srtPath, srtContent, "utf8");
  await job.updateProgress(40);

  const outputPath = path.join(process.cwd(), "tmp", `${videoId}-subtitled.mp4`);
  await applySubtitleStyle(videoPath, srtPath, styleId, outputPath);
  await job.updateProgress(70);

  const processedUrl = await uploadToR2(outputPath, `videos/${videoId}/subtitled.mp4`);
  const srtUrl = await uploadToR2(srtPath, `videos/${videoId}/subtitles.srt`);
  await job.updateProgress(90);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      processedUrl,
      srtUrl,
      status: "EXPORTED",
      processedAt: new Date(),
    },
  });

  await job.updateProgress(100);
  await cleanup([videoPath, srtPath, outputPath]);
}

new Worker<ExportJob>("video-export", processExport, connection);
```

Also add `srtUrl` field in Prisma — migrate later.

- [ ] **Step 1: Write src/workers/exportWorker.ts**
- [ ] **Step 2: Verify TypeScript compiles**

---

### Task 7: Update export API route to enqueue worker

**Files:**
- Modify: `src/app/api/videos/[id]/export/route.ts`

Replace the "QUEUED" stub with a real enqueue to the export worker:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSRT, generateVTT } from "@/lib/subtitle-styles";
import type { SubtitleSegment } from "@/types/subtitle";
import { Queue } from "bullmq";
import type { SubtitleStyleId } from "@/lib/subtitle-styles";

type Params = { params: Promise<{ id: string }> };

function getExportQueue() {
  return new Queue("video-export", {
    connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { format: "SRT" | "VTT" | "VIDEO"; styleId?: SubtitleStyleId };
  const video = await prisma.video.findFirst({
    where: { id, userId: session.user.id },
    include: { transcription: true },
  });

  if (!video?.transcription) {
    return NextResponse.json({ ok: false, error: "Transcrição indisponível" }, { status: 404 });
  }

  const segments = Array.isArray(video.transcription.segments)
    ? (video.transcription.segments as SubtitleSegment[])
    : [];

  if (body.format === "SRT") {
    return NextResponse.json({ ok: true, data: { content: generateSRT(segments), mimeType: "application/x-subrip" } });
  }

  if (body.format === "VTT") {
    return NextResponse.json({ ok: true, data: { content: generateVTT(segments), mimeType: "text/vtt" } });
  }

  if (body.format === "VIDEO") {
    const queue = getExportQueue();
    await queue.add("export-video", { videoId: id, styleId: body.styleId ?? "classic" }, {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    });

    await prisma.video.update({
      where: { id },
      data: { status: "QUEUED" },
    });

    return NextResponse.json({
      ok: true,
      data: { estimatedTimeMinutes: 5, message: "Exportação iniciada" },
    });
  }

  return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
}
```

- [ ] **Step 1: Update src/app/api/videos/[id]/export/route.ts**
- [ ] **Step 2: Verify TypeScript compiles**

---

### Task 8: Add srtUrl to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

Add to Video model:

```
srtUrl    String?
```

Then run `npx prisma db push` to apply.

- [ ] **Step 1: Add srtUrl field to Prisma schema**
- [ ] **Step 2: Run prisma db push**

---

### Task 9: Update frontend — UploadZone & useUpload

**Files:**
- Rewrite: `src/hooks/useUpload.ts`
- Modify: `src/components/upload/UploadZone.tsx`

**useUpload.ts:**
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function uploadFile(file: File): Promise<void> {
    setIsUploading(true);
    setError(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      setProgress(30);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Falha no upload");
      const uploadData = await uploadRes.json();
      setProgress(60);

      const videoRes = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          originalUrl: uploadData.data.url,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      if (!videoRes.ok) throw new Error("Falha ao criar vídeo");
      const videoData = await videoRes.json();
      setProgress(100);

      router.push(`/videos/${videoData.data.videoId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadUrl(url: string): Promise<void> {
    setIsUploading(true);
    setError(null);

    try {
      const videoRes = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Vídeo remoto", originalUrl: url }),
      });
      if (!videoRes.ok) throw new Error("Falha ao processar URL");
      const videoData = await videoRes.json();
      setProgress(100);
      router.push(`/videos/${videoData.data.videoId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload");
    } finally {
      setIsUploading(false);
    }
  }

  return { uploadFile, uploadUrl, isUploading, progress, error };
}
```

**UploadZone.tsx** — minor updates to show progress bar and error messages.

- [ ] **Step 1: Rewrite src/hooks/useUpload.ts**
- [ ] **Step 2: Update UploadZone to show upload progress + error state**
- [ ] **Step 3: Verify build**

---

### Task 10: Update ExportPanel — real API calls

**Files:**
- Modify: `src/components/editor/ExportPanel.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";

export function ExportPanel() {
  const params = useParams();
  const videoId = params.id as string;
  const [exporting, setExporting] = useState(false);

  async function downloadSRT() {
    const res = await fetch(`/api/videos/${videoId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "SRT" }),
    });
    const data = await res.json();
    if (!data.ok) return;
    const blob = new Blob([data.data.content], { type: data.data.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legenda.srt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportVideo() {
    setExporting(true);
    await fetch(`/api/videos/${videoId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "VIDEO" }),
    });
    // Poll until ready
    const poll = setInterval(async () => {
      const res = await fetch(`/api/videos/${videoId}`);
      const data = await res.json();
      if (data?.ok && data.data?.status === "EXPORTED" && data.data?.processedUrl) {
        clearInterval(poll);
        setExporting(false);
        window.open(data.data.processedUrl, "_blank");
      }
      if (data?.ok && data.data?.status === "ERROR") {
        clearInterval(poll);
        setExporting(false);
      }
    }, 3000);
  }

  return (
    <div className="surface flex flex-wrap items-center gap-3 rounded-[var(--radius)] p-4">
      <Button variant="secondary" onClick={downloadSRT}>Baixar SRT</Button>
      <Button variant="secondary">Baixar VTT</Button>
      <Button onClick={exportVideo} disabled={exporting}>
        {exporting ? "Exportando..." : "Exportar Vídeo com Legenda"}
      </Button>
      <Badge>Tempo estimado: 2-5 min</Badge>
    </div>
  );
}
```

- [ ] **Step 1: Update ExportPanel.tsx with real API calls**
- [ ] **Step 2: Verify build**

---

### Task 11: Add worker scripts to package.json

**Files:**
- Modify: `package.json`

Add export worker script:
```
"worker:export": "npx tsx src/workers/exportWorker.ts",
"worker:export:dev": "npx tsx --watch src/workers/exportWorker.ts",
```

- [ ] **Step 1: Add worker scripts to package.json**
