# src/components/

## Responsibility

Presentation layer for the LegendAI subtitle generation application. This directory implements the **React component tree** that renders all user-facing screens, manages user interaction state, and dispatches side effects (API calls, file I/O, navigation). It is organized as a **domain-partitioned component hierarchy** where each subdirectory encapsulates the UI concerns of a specific application domain (auth, billing, dashboard, editor, marketing, payment, plans, upload) atop a shared **Shadcn UI primitive library** (`ui/`) and a common layout shell (`layout/`).

## Design Patterns

| Pattern | Application |
|---|---|
| **Container/Presentational** | `VideoUploadFlow.tsx` orchestrates upload logic while `UploadZone.tsx`, `UploadProgress.tsx`, and `ProcessingStatus.tsx` render discrete visual states. `VideoEditor.tsx` orchestrates editing; `VideoPreview`, `SubtitleEditor`, `ExportPanel`, `StylePicker` are presentational children. |
| **Provider Pattern** | `NextAuthProvider.tsx` wraps the component tree with NextAuth session context, propagating authentication state without prop drilling. |
| **Compound Component** | `PricingTable.tsx` likely composes multiple `PlanCard` instances. `StatsGrid.tsx` composes multiple stat tiles. |
| **Render-Prop / Slot-based Composition** | Shadcn primitives (`card.tsx`, `button.tsx`) expose composable sub-components (e.g., `Card.Header`, `Card.Content`, `Card.Footer`). |
| **State Machine (UI-driven)** | `VideoUploadFlow.tsx` sequences through discrete phases: idle → uploading → processing → complete/error, rendering the appropriate child component per phase. |
| **Facade** | Subdirectory index files (implied) re-export domain components, providing a clean import surface for consumers. |

## Data & Control Flow

```
                         ┌─────────────────────────────┐
                         │      _app.tsx (Root)         │
                         │  NextAuthProvider            │
                         └──────────┬──────────────────┘
                                    │ session context
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
     ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
     │ layout/      │     │ marketing/   │     │ auth/            │
     │ Footer       │     │ Hero,        │     │ LoginForm        │
     └──────────────┘     │ Features,    │     │ RegisterForm     │
                          │ Pricing,     │     │ NextAuthProvider │
                          │ Comparison,  │     └──────────────────┘
                          │ Testimonials,│
                          │ Demo         │
                          └──────┬───────┘
                                 │ authenticated?
                                 ▼
                    ┌────────────────────────┐
                    │     dashboard/          │
                    │  Header, Sidebar        │
                    │  StatsGrid, UsageBar    │
                    │  VideoList, VideoCard   │
                    │  VideoPagination        │
                    └────────┬───────────────┘
                             │ select video
                             ▼
                    ┌────────────────────────┐
                    │     editor/             │
                    │  VideoEditor            │
                    │  ├─ VideoPreview        │
                    │  ├─ SubtitleEditor      │
                    │  │  └─ SubtitleSegment  │
                    │  ├─ TimingAdjuster      │
                    │  ├─ StylePicker         │
                    │  └─ ExportPanel         │
                    └────────────────────────┘

    upload/         billing/          payment/         plans/
  VideoUploadFlow  AvulsoCalculator  CardPayment      PlanCard
  ├─ UploadZone    PaymentSelector   PixPayment
  ├─ UploadProgress
  ├─ UploadLimitBanner
  └─ ProcessingStatus
```

- **Authentication flow**: `NextAuthProvider` injects `session` via React context. `auth/` forms call NextAuth signIn/signUp APIs; on success, the session propagates and the router redirects to `/dashboard`.
- **Dashboard data flow**: `VideoList` fetches paginated video metadata via API (likely server-side fetched in a parent page component or via `useEffect`/SWR). `VideoPagination` emits page-change callbacks. `VideoCard` receives individual video objects as props.
- **Upload flow**: `VideoUploadFlow` manages a **local state machine** (`idle → uploading → processing → done/error`). `UploadZone` captures `File` objects via drag-and-drop or file picker. The parent orchestrator performs chunked upload to a backend endpoint, then polls or receives a processing status, rendering `UploadProgress` and `ProcessingStatus` accordingly. `UploadLimitBanner` checks usage quotas before initiating upload.
- **Editor flow**: `VideoEditor` receives a video/blob URL and initial subtitle data. It coordinates playback via `VideoPreview`, text editing via `SubtitleEditor`/`SubtitleSegment`, timing via `TimingAdjuster`, and styling via `StylePicker`. `ExportPanel` triggers the final SRT/ASS generation.
- **Billing/Payment flow**: `PricingTable` renders `PlanCard` options. Selection routes to `AvulsoCalculator` (one-time) or subscription checkout. `CardPayment` and `PixPayment` handle the actual payment instrument capture and submission to the payment gateway.
- **Marketing flow**: Landing page sections (`Hero`, `Features`, `Pricing`, `Comparison`, `Testimonials`, `Demo`) are purely presentational, receiving content via props or inline constants. They render on unauthenticated routes.

All components consume **Shadcn primitives** (`ui/`) as the atomic UI building blocks — buttons, cards, inputs, textareas, badges, and progress bars — ensuring visual consistency.

## Integration Points

### Depends On

| Dependency | Nature |
|---|---|
| **Next.js App Router** | Page routing via `app/` directory; `useRouter`, `usePathname`, `Link` for navigation |
| **NextAuth.js** | `useSession`, `signIn`, `signOut` consumed by `auth/` and guarded routes |
| **Backend API** | REST endpoints for video CRUD (dashboard), upload (upload), transcription (editor), billing/payment processing |
| **Shadcn/ui** (`ui/`) | Atomic primitives consumed by all domain components |
| **Tailwind CSS** | Utility class-based styling via `className` |
| **Lucide React** (inferred) | Icon library used across dashboard, editor, and marketing components |
| **React Hook Form / Zod** (inferred) | Form state management and validation in `auth/`, `billing/`, `payment/` |
| **react-dropzone** (inferred) | Drag-and-drop file capture in `UploadZone.tsx` |

### Consumed By

| Consumer | Usage |
|---|---|
| `app/(auth)/login/page.tsx` | Renders `LoginForm` |
| `app/(auth)/register/page.tsx` | Renders `RegisterForm` |
| `app/(marketing)/page.tsx` | Composes marketing sections (Hero, Features, Pricing, etc.) |
| `app/(dashboard)/layout.tsx` | Composes `Header` + `Sidebar` + children slot |
| `app/(dashboard)/videos/page.tsx` | Renders `VideoList`, `VideoPagination` |
| `app/(dashboard)/videos/[id]/page.tsx` | Renders `VideoEditor` |
| `app/(dashboard)/upload/page.tsx` | Renders `VideoUploadFlow` |
| `app/(dashboard)/billing/page.tsx` | Renders `PricingTable`, `PlanCard` |
| `app/(dashboard)/billing/payment/page.tsx` | Renders `CardPayment` / `PixPayment` |
| `app/layout.tsx` | Wraps root with `NextAuthProvider`, renders `Footer` |

### Subdirectory Codemaps

Individual codemaps within each subdirectory provide deeper architectural detail:

- [auth/codemap.md](./auth/codemap.md)
- [billing/codemap.md](./billing/codemap.md)
- [dashboard/codemap.md](./dashboard/codemap.md)
- [editor/codemap.md](./editor/codemap.md)
- [layout/codemap.md](./layout/codemap.md)
- [marketing/codemap.md](./marketing/codemap.md)
- [payment/codemap.md](./payment/codemap.md)
- [plans/codemap.md](./plans/codemap.md)
- [ui/codemap.md](./ui/codemap.md)
- [upload/codemap.md](./upload/codemap.md)
