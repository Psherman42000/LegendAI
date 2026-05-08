# src/types/

## Responsibility

Shared TypeScript type definitions that serve as the **contract layer** between the frontend (hooks, stores, components), API routes, and lib utilities. Every domain model, API envelope, and NextAuth augmentation for the LegendAI application is defined here. This directory is the single source of truth for shape contracts — no type is duplicated across feature modules.

## Design Patterns

- **Barrel Re-export** — `index.ts` re-exports all types except `next-auth.d.ts` (which is a module augmentation file, not a regular export). Consumers import from `@/types` instead of individual files.
- **Domain-Split Files** — Each file covers one bounded context: `video.ts` (video lifecycle), `subtitle.ts` (transcription segments), `billing.ts` (payment models), `api.ts` (wire format), and `next-auth.d.ts` (framework extension). This prevents a single monolithic types file.
- **Module Augmentation Pattern** — `next-auth.d.ts` uses `declare module "next-auth"` to merge custom fields (`user.id`) into the upstream `Session` and `JWT` interfaces, following NextAuth's recommended pattern.
- **Type Aliases over Interfaces** — The codebase uses `type` consistently (`export type X = ...`) rather than `interface`, for consistency and the utility of intersection/union operators.
- **Re-exported Upstream Types** — `SubtitleStyle` is re-exported as a type alias (`type SubtitleStyle = SubtitleStyleId`) from `@/lib/subtitle-styles` rather than duplicated, keeping the canonical definition in the lib layer.

## Type Hierarchy & Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                          api.ts (Wire Format)                       │
│                                                                     │
│  ApiResponse<T>     ◄──── Used by all API routes as return type      │
│  { ok, data?, error? }                                              │
│                                                                     │
│  VideoApiResponse   ◄──── Specific response shape for video ops      │
│  { id, status }                                                     │
│         │                                                           │
│         │ references VideoStatus from video.ts                      │
│         ▼                                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         video.ts (Video Model)                      │
│                                                                     │
│  VideoStatus  = union of 10 string literals                         │
│    "UPLOADING" | "QUEUED" | "PROCESSING" | "TRANSCRIBING"           │
│    | "CORRECTING" | "BURNING" | "UPLOADING_OUTPUTS"                 │
│    | "READY" | "EXPORTED" | "ERROR"                                 │
│                                                                     │
│  PaymentType  = "SUBSCRIPTION" | "AVULSO"                           │
│  PaymentMethod = "CARD" | "PIX" | "BOLETO"                         │
│                                                                     │
│  Consumed by: api.ts, all /api/videos routes, hooks, components     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       subtitle.ts (Segment Model)                   │
│                                                                     │
│  SubtitleSegment                                                    │
│  { id, start: number, end: number, text: string,                   │
│    words?: { word, start, end, confidence? }[] }                    │
│                                                                     │
│  SubtitleStyle  = alias for SubtitleStyleId (from lib)              │
│  TranscriptionSegment = alias for SubtitleSegment                   │
│                                                                     │
│  Consumed by: useSubtitles hook, subtitle editor, export lib        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        billing.ts (Billing Model)                   │
│                                                                     │
│  BillingSummary                                                     │
│  { plan: PlanId, amountInCentavos: number, renewAt?: string }       │
│                                                                     │
│  PlanId is imported from @/lib/plans (not redefined)                │
│                                                                     │
│  Consumed by: billing API routes, checkout UI, subscription display │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      next-auth.d.ts (Augmentation)                  │
│                                                                     │
│  Declares module "next-auth":                                       │
│    Session.user.id: string  (added to DefaultSession.user)          │
│  Declares module "next-auth/jwt":                                   │
│    JWT.id?: string                                                  │
│                                                                     │
│  Consumed by: NextAuth config, auth utilities, session-dependent    │
│  code (no explicit import — TypeScript picks it up automatically)   │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Points

| File | Imports From | Imported By |
|---|---|---|
| `video.ts` | (none) | `api.ts`, `@/app/api/videos/**`, `@/hooks/useVideos`, `@/hooks/useVideoProcessing`, `@/types/api.ts` |
| `subtitle.ts` | `@/lib/subtitle-styles` (for SubtitleStyleId) | `@/hooks/useSubtitles`, `@/store/editorStore`, `@/lib/subtitle-styles`, `@/lib/srt-parser`, `@/lib/segment-splitter` |
| `api.ts` | `@/types/video` (VideoStatus) | All route handlers returning `ApiResponse<T>` |
| `billing.ts` | `@/lib/plans` (PlanId) | Billing API routes, checkout pages |
| `next-auth.d.ts` | `next-auth` (DefaultSession) | Next.js build-time type checker (automatically included) |
| `index.ts` | `./api`, `./billing`, `./subtitle`, `./video` | All application code via `@/types` |

## Design Rationale

- **Why re-export from lib into types?** `SubtitleStyle` is conceptually a "type" even though the canonical `SubtitleStyleId` union is derived from a runtime constant in `lib/subtitle-styles`. Re-exporting from `@/types/subtitle` prevents consumers from needing to know whether a type lives in `types/` or `lib/`.
- **Why a separate `next-auth.d.ts`?** Module augmentations must be `.d.ts` files and are auto-included by `tsconfig.json` — placing them in a `.ts` file or the `index.ts` barrel would break the augmentation mechanism.
- **No Zod / validation schemas** — These are plain TypeScript types only. Runtime validation (if any) lives in the API route handlers or lib layer. This keeps the types directory purely declarative.
