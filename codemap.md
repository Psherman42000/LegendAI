# Repository Atlas: LegendAI

## Project Responsibility
SaaS platform for generating Portuguese (BR) subtitles from video. Users upload videos, the system transcribes audio via Whisper, corrects text with LLMs, and produces downloadable SRT/VTT subtitles and burned-in video exports.

## System Entry Points
- `src/app/page.tsx` — Landing page (redirects to marketing)
- `src/app/layout.tsx` — Root layout with providers
- `src/app/api/` — 25+ API route handlers
- `src/workers/videoProcessor.ts` — BullMQ background worker
- `whisper-api/main.py` — FastAPI transcription service

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        LegendAI Stack                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Browser ──▶ Next.js 16 (App Router) ──▶ API Routes             │
│                                              │                    │
│                              ┌───────────────┤                    │
│                              │               │                    │
│                         Cloudflare R2    BullMQ/Redis             │
│                              │               │                    │
│                              │               ▼                    │
│                              │    videoProcessor Worker           │
│                              │    ├─ FFmpeg (audio extract)       │
│                              │    ├─ Whisper API (transcribe)      │
│                              │    ├─ LLM Correction (5 providers) │
│                              │    ├─ FFmpeg (subtitle burn-in)    │
│                              │    └─ R2 Upload (outputs)          │
│                              │               │                    │
│                              │               ▼                    │
│                              │    PostgreSQL (Prisma ORM)         │
│                              │    Resend (email notifications)    │
│                              │    Mercado Pago (payments)         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │  whisper-api (FastAPI + PyTorch + CUDA)                 │      │
│  │  POST /transcribe → segments + timestamps               │      │
│  └─────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

## Video Processing Pipeline

```
UPLOADING → QUEUED → PROCESSING → TRANSCRIBING → CORRECTING → BURNING → UPLOADING_OUTPUTS → READY
                                                                          ↓
                                                                       ERROR
```

## Directory Map (Aggregated)

| Directory | Responsibility Summary | Detailed Map |
|-----------|------------------------|--------------|
| `src/app/` | Next.js 16 App Router: route groups (auth/dashboard/marketing), 25+ API endpoints, page composition | [View Map](src/app/codemap.md) |
| `src/components/` | React UI component library: 10 domain partitions (auth, billing, dashboard, editor, marketing, payment, plans, upload, ui, layout) | [View Map](src/components/codemap.md) |
| `src/lib/` | Core infrastructure facade: 22 modules covering auth, DB, queue, storage (R2), transcription (Whisper), payments (Mercado Pago), email (Resend), LLM correction (5 providers) | [View Map](src/lib/codemap.md) |
| `src/workers/` | Background job processing: BullMQ worker implementing the 8-stage video pipeline (download → audio → transcribe → correct → burn → upload → notify) | [View Map](src/workers/codemap.md) |
| `src/hooks/` | React data hooks: 6 hooks for API state management (videos, upload, subtitles, plan, pricing) with polling and abort patterns | [View Map](src/hooks/codemap.md) |
| `src/store/` | Zustand state stores: 3 atomic stores (editor, upload, user) for client-side ephemeral state | [View Map](src/store/codemap.md) |
| `src/types/` | TypeScript type definitions: 5 domain type files (video, subtitle, billing, api, next-auth) with barrel re-export | [View Map](src/types/codemap.md) |
| `whisper-api/` | FastAPI transcription microservice: Whisper model inference with CUDA GPU support, segment/word timestamps, confidence scoring | [View Map](whisper-api/codemap.md) |

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: Next.js 16, React 19, Prisma 7, BullMQ, OpenAI, Mercado Pago |
| `next.config.ts` | Turbopack, PWA config, image optimization |
| `middleware.ts` | Rate limiting (10 req/min/IP), auth cookie check |
| `prisma/schema.prisma` | PostgreSQL schema: User, Video, Transcription, Subscription, Payment, WebhookLog |
| `tsconfig.json` | TypeScript strict mode, `@/*` path alias |
| `whisper-api/main.py` | FastAPI app: /health, /transcribe endpoints |
| `whisper-api/Dockerfile` | CUDA 12.5.1 runtime, Python 3, FFmpeg |

## External Service Dependencies

| Service | Purpose | Config |
|---------|---------|--------|
| PostgreSQL | Primary database | `DATABASE_URL` |
| Redis | BullMQ job queue | `REDIS_URL` |
| Cloudflare R2 | Video/audio storage | `R2_*` env vars |
| NextAuth.js | Google OAuth auth | `NEXTAUTH_*`, `GOOGLE_*` |
| OpenAI | Whisper fallback + GPT correction | `OPENAI_API_KEY` |
| Google Gemini | LLM correction alternative | `GEMINI_API_KEY` |
| Mercado Pago | Brazilian payments | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| Resend | Email notifications | `RESEND_API_KEY` |
| Whisper API (local) | Primary transcription | `WHISPER_API_URL` |