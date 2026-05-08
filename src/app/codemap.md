# `src/app/`

## Responsibility

**Next.js 16 App Router entry point** — serves as the application's routing layer, request-handling boundary, and composition root. Owns all URL-addressable entry points (pages + API routes), delegates business logic to `@/lib/*` modules and `@/components/*`, and enforces authentication boundaries via session checks at the route level. Implements a **three-zone content separation** pattern (auth, dashboard, marketing) with distinct layouts and access control policies.

---

## Design Patterns

### 1. Route Group Segregation (`(groupName)/`)
Three isolated route groups partition the URL space by access level and visual chrome:
- **`(auth)/`** — Unauthenticated pages (login, register). Centered card layout, no sidebar. Cannot access if already authenticated (session redirect on login page).
- **`(dashboard)/`** — Protected pages requiring authentication. Shared sidebar layout (`lg:grid lg:grid-cols-[280px_1fr]`). Each page independently checks session and redirects to `/login` if absent.
- **`(marketing)/`** — Public landing page. Minimal full-width layout.

The root `page.tsx` re-exports `(marketing)/page`, making the landing page the default entry.

### 2. Layout Chain Composition
Nested layouts compose visual structure:
```
RootLayout (<html>, <NextAuthProvider>)
  ├── AuthLayout (centered grid, auth zone)
  ├── DashboardLayout (sidebar grid, protected zone)
  └── MarketingLayout (full-width, public zone)
```
Each layout is a thin wrapper providing structure only — no data fetching. Authentication state is injected at the page level, not in layouts, enabling per-page granularity.

### 3. Server Component First / Client Component at Leaves
Pages default to **async Server Components** (`export default async function Page()`). Data fetching (Prisma queries, `getServerSession`) happens directly in the page body. Client interactivity is pushed to leaf components (`"use client"` at `UploadPage`, `SettingsPage`, `PaymentPage`, `PlansList`). This follows the RSC pattern of keeping the data layer server-side and only hydrating interactive islands.

### 4. Route Handler — Resource CRUD Pattern
API routes follow a consistent structure:
- **Authentication guard as first operation** — `getServerSession(authOptions)` at the top of every handler, returning `401` if missing.
- **Resource ownership scoping** — `prisma.video.findFirst({ where: { id, userId: session.user.id } })` ensures users can only access their own data.
- **Type-safe params** — `type Params = { params: Promise<{ id: string }> }` with `await params` to handle Next.js 16 async params contract.
- **Uniform response envelope** — `{ ok: boolean, data?: T, error?: string, pagination?: Pagination }` across all endpoints.
- **Best-effort side effects** — Worker triggers and queue enqueues use `.catch(() => undefined)` to avoid failing the primary operation on secondary failures.

### 5. Webhook Idempotency via Unique Constraint
Mercado Pago webhook (`api/billing/webhook/mercadopago`) uses a `webhookLog` unique constraint on `(provider, notificationId)` to deduplicate incoming notifications. Prisma `P2002` errors are caught and returned as `{ ok: true, duplicate: true }` — a common webhook idempotency pattern.

### 6. Worker-Boundary Pattern with HMAC Auth
The `api/videos/[id]/process` endpoint is the **write-back channel** from the external video processing worker. It authenticates via `x-worker-secret` header (HMAC-style shared secret pattern), not session cookies, since the worker runs outside the browser context. The worker updates video status through a state machine: `QUEUED → TRANSCRIBING → CORRECTING → EXPORTED → READY` (or `ERROR`).

### 7. Signed URL Refresh Pattern
R2 (Cloudflare) presigned URLs expire after 24h. Video list and detail endpoints detect `READY` / `EXPORTED` status and regenerate fresh signed URLs (`getSignedUrlFromAny`) before returning data to the client. This prevents stale URL 401 errors without storing long-lived credentials.

### 8. Singleton Provider Wrapper
The root layout wraps children in `<NextAuthProvider>` — a client component (`"use client"`) that provides session context via React context. Pages that need client-side session access (settings, upload) use `useSession()`; server-side pages use `getServerSession()` directly.

---

## Data & Control Flow

### Inbound (Pages → Data)

```
Browser Request
    │
    ▼
[Page Server Component]
    ├── getServerSession(authOptions)    ← Session validation
    ├── prisma.findMany/findUnique        ← Database reads
    ├── fetch(`/api/...`, { cookie })     ← Internal API calls (videos page)
    └── Returns JSX (or redirect)
```

The videos list page (`(dashboard)/videos/page.tsx`) demonstrates a unique **server-to-server fetch pattern**: the page calls its own API endpoint (`/api/videos`) with the session cookie forwarded, rather than querying Prisma directly. This reuses the API's signed URL logic and pagination. Other pages (dashboard, plans) query Prisma directly.

### Outbound (API Routes → Services)

```
API Request
    │
    ▼
[Route Handler]
    ├── getServerSession / WORKER_SECRET  ← Auth (session or shared secret)
    ├── Prisma operations                  ← Database CRUD
    ├── criarAssinatura / criarPagamento   ← Mercado Pago API
    ├── uploadBufferToR2 / deleteFromR2    ← Cloudflare R2 storage
    ├── enqueueVideoJob / Queue            ← BullMQ / Redis
    ├── sendEmail                          ← Email notifications
    └── Returns Response.json({ ok, data|error })
```

### Payment Flow

```
User selects PIX/CARD
    │
    ▼
api/billing/avulso (POST)
    ├── create Payment record (PENDING)
    ├── criarPagamentoAvulso() → Mercado Pago checkout
    ├── update Payment with mpPaymentId, pixQrCode, etc.
    └── Return checkout data to client
        │
        ▼
    Mercado Pago webhook → api/billing/webhook/mercadopago
        ├── Validate HMAC signature
        ├── Deduplicate via webhookLog
        ├── Update Payment → PAID
        └── Send notification email
```

### Video Processing Flow

```
Upload
    │
    ▼
api/upload (POST) → R2 storage → presigned URL
    │
    ▼
api/videos (POST) → Create Video (QUEUED) + enqueueVideoJob + triggerWorker
    │
    ▼
[External Worker] ← reads from BullMQ queue
    │
    ├── POST api/videos/[id]/process (step: TRANSCRIBED)  → Update status + create Transcription
    ├── POST api/videos/[id]/process (step: CORRECTED)    → Update correctedText
    └── POST api/videos/[id]/process (step: READY)        → Set processedUrl, status=READY
        │
        ▼
    Client polls GET api/videos/[id] → sees READY → displays video + subtitles
```

---

## Integration Points

### Internal Dependencies (`@/lib/*`)
| Module | Used By |
|--------|---------|
| `@/lib/auth` (authOptions) | All API routes + dashboard/auth pages (session validation) |
| `@/lib/db` (prisma) | All API routes + server pages (database access) |
| `@/lib/plans` (PLANS, calcularPrecoAvulso) | Plans/billing pages, checkout route |
| `@/lib/r2` (upload, signed URLs, delete) | Upload route, video CRUD, retry route |
| `@/lib/mercadopago` (criarAssinatura, criarPagamentoAvulso) | Checkout, avulso payment routes |
| `@/lib/queue` (enqueueVideoJob, triggerWorker) | Video create, retry routes |
| `@/lib/subtitle-styles` (generateSRT, generateVTT) | Transcription export routes |
| `@/lib/worker-spawn` (startDetachedWorker) | Worker start route |
| `@/lib/health` (checkDatabase, checkRedis, checkR2) | Health route |
| `@/lib/email` (sendLimitReachedEmail, sendWebhookNotification) | Webhook handler |

### Internal Dependencies (`@/components/*`)
| Component | Page(s) |
|-----------|---------|
| `@/components/auth/NextAuthProvider` | Root layout |
| `@/components/auth/LoginForm` | `(auth)/login/page` |
| `@/components/auth/RegisterForm` | `(auth)/register/page` |
| `@/components/dashboard/Sidebar` | `(dashboard)/layout` |
| `@/components/dashboard/Header` | Dashboard, Videos pages |
| `@/components/dashboard/StatsGrid` | Dashboard page |
| `@/components/dashboard/VideoList` | Dashboard, Videos pages |
| `@/components/dashboard/VideoPagination` | Videos page |
| `@/components/upload/UploadZone` | Upload page |
| `@/components/upload/UploadLimitBanner` | Upload page |
| `@/components/editor/VideoEditor` | `videos/[id]/page` |
| `@/components/editor/ExportPanel` | `videos/[id]/export/page` |
| `@/components/payment/PixPayment` | Payment page |
| `@/components/payment/CardPayment` | Payment page |
| `@/components/plans/PlanCard` | Plans list |
| `@/components/billing/PricingTable` | Billing page |
| `@/components/billing/AvulsoCalculator` | Billing page |
| `@/components/marketing/*` (Hero, Features, etc.) | Landing page |
| `@/components/layout/Footer` | Landing page |
| `@/components/ui/*` (Card, Input, Button) | Settings page |

### External Services
| Service | Integration Point | Auth Mechanism |
|---------|------------------|----------------|
| **NextAuth.js** | `api/auth/[...nextauth]/route` | OAuth / Credentials via `authOptions` |
| **Prisma (PostgreSQL)** | All API + server pages | Direct connection via `@/lib/db` |
| **BullMQ / Redis** | Video queue (enqueue/export) | `REDIS_URL` env var |
| **Cloudflare R2** | Upload, video storage, signed URLs | R2 credentials via `@/lib/r2` |
| **Mercado Pago** | Checkout, avulso payment, webhook | Mercado Pago API credentials, HMAC webhook signature |
| **UploadThing** | `api/uploadthing/route` (stub — returns 501) | Not activated |
| **Email (SMTP)** | Webhook notifications | SMTP credentials via `@/lib/email` |

### Consumer Modules
External consumers of these routes:
- **Video processing worker** — Calls `POST /api/videos/[id]/process` with `x-worker-secret` header to report progress and results.
- **Mercado Pago** — Sends webhook events to `POST /api/billing/webhook/mercadopago`.
- **Client-side browser** — SPA-style navigation to pages; form submissions to API routes; polling for video status.

---

## File Index

```
src/app/
├── page.tsx                              # Root redirect → (marketing)/page
├── layout.tsx                            # Root layout: <html> + NextAuthProvider
├── globals.css                           # Global CSS / Tailwind
├── manifest.ts                           # PWA manifest
├── favicon.ico
│
├── (auth)/
│   ├── layout.tsx                        # Centered card layout
│   ├── login/page.tsx                    # Server: redirect if authed → LoginForm
│   └── register/page.tsx                 # Server → RegisterForm
│
├── (dashboard)/
│   ├── layout.tsx                        # Sidebar grid layout
│   ├── dashboard/page.tsx                # Server: stats, usage, video list (direct Prisma)
│   ├── billing/page.tsx                  # Server → PricingTable + AvulsoCalculator
│   ├── payment/page.tsx                  # Client: PIX/CARD payment method selector
│   ├── plans/page.tsx                    # Server: fetch plans from DB → PlansList
│   ├── plans/PlansList.tsx               # Client: plan card grid
│   ├── plans/loading.tsx                 # Suspense fallback
│   ├── plans/error.tsx                   # Error boundary
│   ├── settings/page.tsx                 # Client: profile/theme/notifications
│   ├── upload/page.tsx                   # Client: upload zone + limit banner
│   ├── videos/page.tsx                   # Server: fetch via internal API (pagination)
│   ├── videos/[id]/page.tsx              # Server → VideoEditor
│   └── videos/[id]/export/page.tsx       # Server → ExportPanel
│
├── (marketing)/
│   ├── layout.tsx                        # Full-width layout
│   └── page.tsx                          # Landing page: Hero → Features → ... → Footer
│
└── api/
    ├── health/route.ts                   # GET: database/redis/r2 health check
    ├── auth/[...nextauth]/route.ts       # NextAuth.js handler (GET/POST)
    │
    ├── upload/route.ts                   # POST: file upload → R2 or disk
    ├── uploadthing/route.ts              # Stub (501 not implemented)
    │
    ├── videos/route.ts                   # GET: list (paginated, signed URLs)
    │                                     # POST: create (auth, limits, tx, queue)
    ├── videos/[id]/route.ts              # GET/PATCH/DELETE: single video CRUD
    ├── videos/[id]/download/route.ts     # GET: download video or SRT file
    ├── videos/[id]/export/route.ts       # POST: export SRT/VTT/VIDEO (BullMQ)
    ├── videos/[id]/process/route.ts      # POST: worker callback (HMAC auth)
    ├── videos/[id]/retry/route.ts        # POST: re-enqueue failed video
    │
    ├── transcriptions/[videoId]/route.ts # GET/PATCH/DELETE/OPTIONS
    ├── transcriptions/[videoId]/srt/route.ts  # GET: SRT content
    ├── transcriptions/[videoId]/vtt/route.ts  # GET: VTT content
    │
    ├── user/me/route.ts                  # GET/PATCH: user profile
    ├── user/usage/route.ts               # GET: monthly usage + plan limits
    │
    ├── subscription/route.ts             # POST: create/update subscription (mock)
    │
    ├── billing/checkout/route.ts         # POST: Mercado Pago subscription checkout
    ├── billing/plans/route.ts            # GET: plan list from PLANS constant
    ├── billing/portal/route.ts           # POST: subscription + payment history
    ├── billing/avulso/route.ts           # POST: create avulso (PIX or CARD)
    ├── billing/avulso/[id]/route.ts      # GET: check avulso payment status
    └── billing/webhook/mercadopago/route.ts # POST: MP webhook (HMAC, idempotent)
    │
    ├── payment/card/route.ts             # POST: mock card payment (PCI warning)
    ├── payment/pix/route.ts              # POST: mock PIX payment
    │
    └── worker/start/route.ts             # POST: spawn detached worker process
```

---

## Route Map Summary

| URL Pattern | HTTP Methods | Auth | Description |
|---|---|---|---|
| `/` | GET | No | Landing page (re-export) |
| `/login` | GET | No | Login form |
| `/register` | GET | No | Registration form |
| `/dashboard` | GET | Yes | Home dashboard with stats |
| `/upload` | GET | Yes | File upload page |
| `/videos` | GET | Yes | Paginated video list |
| `/videos/[id]` | GET | Yes | Video editor |
| `/videos/[id]/export` | GET | Yes | Export panel |
| `/billing` | GET | Yes | Billing & pricing |
| `/plans` | GET | Yes | Subscription plans |
| `/payment` | GET | Yes | Avulso payment |
| `/settings` | GET | Yes | User settings |
| `/api/health` | GET | No | Service health check |
| `/api/auth/[...nextauth]` | GET/POST | No | NextAuth handler |
| `/api/upload` | POST | Yes | File upload (R2/disk) |
| `/api/videos` | GET/POST | Yes | List / create video |
| `/api/videos/[id]` | GET/PATCH/DELETE | Yes | Video CRUD |
| `/api/videos/[id]/download` | GET | Yes | Download video/SRT |
| `/api/videos/[id]/export` | POST | Yes | Export subtitle formats |
| `/api/videos/[id]/process` | POST | Worker | Worker progress callback |
| `/api/videos/[id]/retry` | POST | Yes | Retry failed video |
| `/api/transcriptions/[videoId]` | GET/PATCH/DELETE/OPTIONS | Yes | Transcription CRUD |
| `/api/transcriptions/[videoId]/srt` | GET | Yes | SRT content |
| `/api/transcriptions/[videoId]/vtt` | GET | Yes | VTT content |
| `/api/user/me` | GET/PATCH | Yes | User profile |
| `/api/user/usage` | GET | Yes | Monthly usage stats |
| `/api/subscription` | POST | Yes | Mock subscription |
| `/api/billing/checkout` | POST | Yes | MP checkout |
| `/api/billing/plans` | GET | No | Plan listing |
| `/api/billing/portal` | POST | Yes | Billing portal data |
| `/api/billing/avulso` | POST | Yes | Create avulso payment |
| `/api/billing/avulso/[id]` | GET | Yes | Check payment status |
| `/api/billing/webhook/mercadopago` | POST | HMAC | MP webhook handler |
| `/api/payment/card` | POST | Yes | Mock card payment |
| `/api/payment/pix` | POST | Yes | Mock PIX payment |
| `/api/worker/start` | POST | Secret | Spawn worker process |
