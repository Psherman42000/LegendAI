# src/store/

## Responsibility

Lightweight Zustand global stores that hold cross-component UI and user state that would be impractical to pass via props or lift to React context. Each store is a single slice with minimal surface area — stores are **observable singletons** that avoid prop drilling for editor playback position, subtitle style selection, upload progress, and user profile data.

## Design Patterns

- **Atomic Zustand Stores** — Each store is an independent `create()` call. No combined root store, no slices composition. Stores are imported individually by components that need them.
- **Minimal Surface Area** — Each store has 2–4 state fields with 1–2 setter actions. No async thunks, no middleware, no selectors beyond inlined destructuring.
- **Direct Mutation via Setters** — All mutations use the idiomatic Zustand `set()` pattern. No reducer, no immer. Setter functions are stored as first-class properties on the store object, not exposed via a separate actions object.
- **No Persistence Middleware** — No `zustand/middleware` (no persist, no devtools). State is ephemeral — lost on page refresh.
- **TypeScript First** — Each store defines a private `type XState = { ... }` above the `create()` call for type safety and editor autocompletion.

## Data & Control Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Zustand Store                         │
│                                                              │
│  editorStore.ts                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ selectedStyle: SubtitleStyle (default: "classic")    │────┼──▶ SubtitleEditor component
│  │ currentTime: number    (default: 0)                  │────┼──▶ VideoPlayer / timeline
│  │ setSelectedStyle(style)                               │    │
│  │ setCurrentTime(time)                                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  uploadStore.ts                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ progress: number      (default: 0)                   │────┼──▶ Upload progress bar
│  │ fileName: string|null (default: null)                │────┼──▶ Upload UI display
│  │ setProgress(n)                                       │    │
│  │ setFileName(name)                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  userStore.ts                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ name: string|null   (default: null)                  │────┼──▶ Navbar / account UI
│  │ email: string|null  (default: null)                  │────┼──▶ Billing / settings
│  │ plan: PlanId        (default: "FREE")                │────┼──▶ Upload gate / limits
│  │ setUser({ name, email, plan })                       │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

  Written by:                                      Read by:
  ─────────────────────                          ─────────────────────
  useUpload hook sets uploadStore fields          UploadProgressBar reads uploadStore
  on progress updates                             SubtitleEditor reads/writes editorStore
  userStore.setUser() called after                VideoPlayer syncs currentTime
    auth login / session load                     Navbar reads userStore.name + plan
```

## Integration Points

| Store | Written By | Read By | External Dependencies |
|---|---|---|---|
| `editorStore` | SubtitleEditor component (on time/seek, on style pick) | VideoPlayer (currentTime), SubtitleEditor (selectedStyle) | `@/types/subtitle` (SubtitleStyle alias) |
| `uploadStore` | `useUpload` hook (called from UploadPage) | UploadProgressBar, upload completion UI | none |
| `userStore` | Auth callback / session provider (after login) | Navbar (avatar/name), upload gate (plan check), billing UI | `@/lib/plans` (PlanId type) |

## Design Rationale

- **Why Zustand, not Context?** Zustand avoids re-render cascading — consumers subscribe to specific slices, so `editorStore.setCurrentTime()` does not re-render the navbar. Context would require splitting or memoization to achieve the same.
- **Why separate stores instead of one?** Domain isolation prevents unrelated state changes from triggering selector re-evaluations. The stores are tiny — coupling them would add no benefit.
- **Why no persistence?** User identity is ephemeral (loaded from session on mount); upload progress is transient; editor state resets per session. No data in stores is worth caching to localStorage.
