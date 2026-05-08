# src/hooks/

## Responsibility

Client-side React hooks layer that encapsulates all UI-facing business logic, state management, and API interaction for the LegendAI subtitle editor. Each hook owns a single domain concern (pricing, plans, subtitles, upload, processing, video listing) and exposes a pure interface to React components, isolating them from direct fetch calls, caching logic, and lib-level functions.

## Design Patterns

- **Custom Hook per Concern** — Each domain (upload, subtitles, plans, videos, pricing, processing) has exactly one hook. No cross-hook coupling; composition is left to the consumer component.
- **Controlled Local State** — `useUpload`, `useVideos`, and `usePlan` manage local `useState` for loading/error/data tristate. `useVideoProcessing` delegates to **TanStack Query (`@tanstack/react-query`)** for automatic refetch and cache invalidation. `useSubtitles` owns the full segments array in local state with immutable update operations. `useAvulsoPrice` uses `useMemo` for pure derivation.
- **Imperative API Calls via fetch** — All hooks (except `useAvulsoPrice`) perform `fetch()` to Next.js API routes (`/api/...`). No shared HTTP client or axios. Error handling is per-hook with try/catch returning `null` or string errors.
- **Memoized Return Values** — `useSubtitles` wraps its return object in `useMemo` to stabilize references. `useAvulsoPrice` uses `useMemo` for price calculations.
- **Cleanup via AbortController** — `useVideos` uses `AbortController` to cancel in-flight requests on unmount, preventing state updates on unmounted components.

## Data & Control Flow

```
React Component
  └─ calls useUpload()
       ├─ uploadFile(file) → POST /api/upload (multipart) → POST /api/videos (JSON)
       ├─ uploadUrl(url)   → POST /api/videos (JSON)
       └─ returns { isUploading, progress, error, uploadedVideo, useAiCorrection, setUseAiCorrection }

  └─ calls usePlan()
       └─ useEffect → GET /api/user/usage → returns { plan, videosUsed, videosLimit, isAtLimit, canUpload, isLoading }

  └─ calls useVideos()
       └─ useEffect → GET /api/videos (AbortController) → returns { videos: VideoItem[], loading, error }

  └─ calls useVideoProcessing(videoId)
       └─ useQuery → GET /api/videos/:id (polling every 5s until READY) → returns { video, status, progress, isProcessing, isReady, isError }

  └─ calls useSubtitles(transcriptionId)
       └─ local useState<SubtitleSegment[]>
       ├─ updateSegment(id, text)
       ├─ deleteSegment(id)
       ├─ splitSegment(id, splitAt)
       ├─ mergeSegments(idA, idB)
       ├─ exportSRT() → generates SRT string via lib/subtitle-styles
       └─ exportVTT() → generates VTT string via lib/subtitle-styles

  └─ calls useAvulsoPrice(durationSeconds)
       └─ useMemo → calcularPrecoAvulso() from lib/plans → { priceInCentavos, priceFormatted, isMinimumApplied }
```

## Integration Points

| Hook | Consumes From | Consumed By |
|---|---|---|
| `useUpload` | `POST /api/upload`, `POST /api/videos` | Upload page / video creation UI |
| `usePlan` | `GET /api/user/usage`, `@/lib/plans` (PlanId enum) | Upload page (gate), billing UI, navbar |
| `useVideos` | `GET /api/videos` | Library / dashboard list pages |
| `useVideoProcessing` | `GET /api/videos/:id`, `@tanstack/react-query` | Video detail / processing status UI |
| `useSubtitles` | `@/lib/subtitle-styles` (generateSRT, generateVTT), `@/types/subtitle` (SubtitleSegment) | Subtitle editor component |
| `useAvulsoPrice` | `@/lib/plans` (calcularPrecoAvulso) | Avulso (one-time) pricing UI |

## Dependencies

- **External:** `react`, `@tanstack/react-query`
- **Internal:** `@/lib/plans`, `@/lib/subtitle-styles`, `@/types/subtitle`
- **API Routes:** `/api/upload`, `/api/videos`, `/api/videos/:id`, `/api/user/usage`
