# Bugfixes Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 production bugs reported by the user after the production-fixes deployment.

**Architecture:** Targeted fixes to existing files. No new major features — only bug fixes and UX improvements.

**Tech Stack:** Next.js 16, Prisma 7, BullMQ, R2/S3, NextAuth v4, Whisper, FFmpeg

---

## Bug Summary

| # | Bug | Root Cause | Priority |
|---|-----|-----------|----------|
| 1 | Wrong email in dashboard sidebar | TBD — session/database auth investigation needed | High |
| 2 | R2 download returns 401 | `GET /api/videos/[id]` returns raw URLs without signing | High |
| 3 | Subtitles always show 3 words | `maxWordsPerChunk: 3` hardcoded, no dynamic grouping | High |
| 4 | AI correction barely changes text | `useAiCorrection` flag ignored + overly conservative prompt | High |
| 5 | Monthly usage bar not tracking | UsageBar component may not be fetching correctly | Medium |
| 6 | Worker crashes and doesn't restart | No auto-restart on crash, only idle shutdown | Medium |
| 7 | Purchase flow shows before video loaded | AvulsoCalculator shown before file size/duration known | Medium |
| 8 | Video preview crashes | Same root cause as #2 — unsigned R2 URLs | High (same fix as #2) |

---

## Task 1: Fix R2 401 — Sign URLs in Video Detail Endpoint

**Files:**
- Modify: `src/app/api/videos/[id]/route.ts`

**Root Cause:** `GET /api/videos/[id]` returns raw `video.processedUrl`, `video.srtUrl`, etc. from the database. These are R2 public URLs that return 401 because the bucket doesn't allow public access. The list endpoint (`GET /api/videos`) already signs these URLs correctly using `getSignedUrlFromAny`.

**Fix:** Add URL signing to the detail endpoint, mirroring the list endpoint's approach.

- [ ] **Step 1:** Read `src/app/api/videos/route.ts` (the list endpoint) to see how it signs URLs for READY/EXPORTED videos
- [ ] **Step 2:** Read `src/app/api/videos/[id]/route.ts` to understand current structure
- [ ] **Step 3:** Add `getSignedUrlFromAny` import from `@/lib/r2`
- [ ] **Step 4:** After fetching the video, if `video.status === "READY" || video.status === "EXPORTED"`, sign `processedUrl`, `srtUrl`, `audioUrl`, `thumbnailUrl` using `getSignedUrlFromAny`
- [ ] **Step 5:** Return the signed URLs in the response, keeping other fields unchanged
- [ ] **Step 6:** Run targeted ESLint on the modified file
- [ ] **Step 7:** Commit: `fix(api): sign R2 URLs in video detail endpoint`

---

## Task 2: Fix Subtitle Timing — Dynamic Grouping by Speech Pauses

**Files:**
- Modify: `src/lib/segment-splitter.ts`
- Modify: `src/workers/videoProcessor.ts`

**Root Cause:** `splitSegmentsByWords` uses a fixed `maxWordsPerChunk: 3`. The user wants dynamic grouping based on natural speech pauses, with configurable speed.

**Design:** Replace fixed chunk size with a pause-based algorithm:
1. **Respect natural pauses:** When Whisper detects a silence gap between words (e.g., >0.3s), break the subtitle there regardless of word count
2. **Dynamic word grouping:** Group words that are spoken close together (gap < 0.15s) into the same subtitle line
3. **Speed presets:** Allow the caller to pass a `speed` parameter:
   - `"fast"`: 1-2 words per line, min duration 0.5s
   - `"normal"` (default): 2-4 words per line, min duration 0.8s
   - `"slow"`: 3-5 words per line, min duration 1.2s
4. **Max duration cap:** Never exceed `maxDurationSeconds` (default 3.0s) per subtitle line
5. **Never break mid-phrase:** If words are spoken rapidly (gap < 0.1s), keep them together even if it exceeds the word count for the speed preset

- [ ] **Step 1:** Read current `src/lib/segment-splitter.ts` fully
- [ ] **Step 2:** Redesign `splitSegmentsByWords` to accept a `speed` parameter (`"fast" | "normal" | "slow"`) instead of `maxWordsPerChunk`
- [ ] **Step 3:** Implement pause-based grouping:
  - Calculate gap between consecutive words: `nextWord.start - currentWord.end`
  - If gap > `pauseThreshold` (0.3s), force a break
  - If gap < `tightThreshold` (0.1s), keep words together (tight grouping)
  - Otherwise, respect the speed preset's word count range
- [ ] **Step 4:** Define speed presets as constants:
  ```
  SPEED_PRESETS = {
    fast:   { minWords: 1, maxWords: 2, minDuration: 0.5, maxDuration: 2.0, pauseThreshold: 0.3, tightThreshold: 0.1 }
    normal: { minWords: 2, maxWords: 4, minDuration: 0.8, maxDuration: 3.0, pauseThreshold: 0.3, tightThreshold: 0.1 }
    slow:   { minWords: 3, maxWords: 5, minDuration: 1.2, maxDuration: 4.0, pauseThreshold: 0.3, tightThreshold: 0.1 }
  }
  ```
- [ ] **Step 5:** Update `src/workers/videoProcessor.ts` to pass `speed: "normal"` (default) to `splitSegmentsByWords`
- [ ] **Step 6:** Ensure the `WordLevelSegment` type is still compatible with downstream consumers (`writeSrtFile`, `saveTranscription`)
- [ ] **Step 7:** Run targeted ESLint on both files
- [ ] **Step 8:** Commit: `feat(subtitles): dynamic grouping by speech pauses with speed presets`

---

## Task 3: Fix AI Correction — Aggressive Prompt + Functional Toggle

**Files:**
- Modify: `src/lib/correction/index.ts`
- Modify: `src/lib/correction/opencode.ts`
- Modify: `src/lib/correction/openai.ts`
- Modify: `src/lib/correction/gemini.ts`

**Root Cause:** Two problems:
1. `useAiCorrection` parameter is accepted but never checked — correction always runs
2. The prompt is too conservative ("corrija apenas erros CLAROS") causing "leginda" to stay unchanged

**Fix:**

- [ ] **Step 1:** Read all four correction files
- [ ] **Step 2:** In `src/lib/correction/index.ts`, add early return when `useAiCorrection === false`:
  ```typescript
  if (!useAiCorrection) {
    console.log("[Correction] AI correction disabled, returning original segments");
    return segments;
  }
  ```
- [ ] **Step 3:** Update the system prompt in ALL THREE correction providers (opencode.ts, openai.ts, gemini.ts) to be more aggressive:
  ```
  Você é um revisor especialista em português brasileiro coloquial para criadores de conteúdo.
  Sua tarefa é corrigir erros de transcrição automática mantendo o estilo falado do criador.

  REGRAS OBRIGATÓRIAS:
  1. Corrija TODOS os erros fonéticos do Whisper em PT-BR — o Whisper frequentemente troca:
     - "legenda" → "leginda", "legendador" → "legindador"
     - "não é" ↔ "né" (contexto coloquial)
     - "para" ↔ "pra" (contexto coloquial)
     - "está" ↔ "tá" (contexto coloquial)
     - "você" ↔ "cê" (contexto coloquial)
     - "a gente" ↔ "agente" (contexto)
     - Nomes próprios brasileiros: Anitta, Flamengo, Nubank, etc.
  2. Mantenha expressões coloquiais: "né", "tá", "pra", "tô", "tava", "num" (= não), "cê" (= você)
  3. Adicione pontuação natural onde falta (vírgulas, pontos finais, reticências)
  4. NÃO formalize a linguagem — mantenha o tom falado
  5. NÃO altere o timing dos segmentos
  6. NÃO mude o significado de nenhuma frase
  7. Se uma palavra parece errada no contexto, corrija — o Whisper erra muito em PT-BR

  Retorne JSON com a mesma estrutura dos segmentos de entrada, apenas com os textos corrigidos.
  Preserve os campos `start`, `end` e `words` exatamente como receber.
  ```
- [ ] **Step 4:** In each correction provider, add explicit instruction to preserve `words` array:
  ```
  Preserve os campos `start`, `end` e `words` exatamente como receber.
  ```
- [ ] **Step 5:** In `index.ts`, add logging when all correction strategies fail:
  ```typescript
  console.error("[Correction] All strategies failed, returning original segments");
  ```
- [ ] **Step 6:** Run targeted ESLint on all four files
- [ ] **Step 7:** Commit: `fix(correction): aggressive prompt + functional useAiCorrection toggle`

---

## Task 4: Fix Wrong Email in Dashboard

**Files:**
- Investigate: `src/components/dashboard/Sidebar.tsx`
- Investigate: `src/lib/auth.ts`
- Investigate: Prisma User model
- Possibly modify: `src/app/api/auth/[...nextauth]/route.ts` or session callback

**Root Cause:** TBD — the Sidebar uses `useSession()` from NextAuth with `strategy: "database"`. The email shown comes from `session.user.email`. Need to verify:
1. What email is stored in the database for the logged-in user
2. Whether the session callback is returning the correct user
3. Whether there's a caching issue with `useSession()`

- [ ] **Step 1:** Check the Prisma User model and Account model in `prisma/schema.prisma`
- [ ] **Step 2:** Check if there's a NextAuth route handler at `src/app/api/auth/[...nextauth]/route.ts`
- [ ] **Step 3:** Verify the session callback in `src/lib/auth.ts` — does it include email?
- [ ] **Step 4:** Check if `useSession()` is fetching from the correct endpoint
- [ ] **Step 5:** If the issue is in the session callback, add `session.user.email = user.email` to the callback
- [ ] **Step 6:** If the issue is database-related, check if the User table has the correct email
- [ ] **Step 7:** Run targeted ESLint
- [ ] **Step 8:** Commit: `fix(auth): ensure correct email in session callback`

---

## Task 5: Fix Monthly Usage Bar

**Files:**
- Investigate: `src/components/dashboard/UsageBar.tsx`
- Investigate: `src/hooks/usePlan.ts`
- Investigate: `src/app/api/user/usage/route.ts`

**Root Cause:** TBD — the UsageBar component may not be fetching data correctly or the API may not be returning the right data.

- [ ] **Step 1:** Read `src/components/dashboard/UsageBar.tsx` fully
- [ ] **Step 2:** Read `src/hooks/usePlan.ts` fully
- [ ] **Step 3:** Read `src/app/api/user/usage/route.ts` fully
- [ ] **Step 4:** Trace the data flow: UsageBar → usePlan → API → Prisma
- [ ] **Step 5:** Identify where the data breaks (wrong query? wrong field? missing update?)
- [ ] **Step 6:** Fix the data flow to correctly track and display monthly video usage
- [ ] **Step 7:** Run targeted ESLint
- [ ] **Step 8:** Commit: `fix(usage): correct monthly usage bar tracking and display`

---

## Task 6: Worker Resilience — Auto-Restart + Deduplication

**Files:**
- Modify: `scripts/start-worker.ts`
- Modify: `src/lib/queue.ts`
- Possibly modify: `src/app/api/worker/start/route.ts`

**Design:** Make the on-demand worker architecture resilient to crashes:
1. **`start-worker.ts`**: Check if a worker is already running before starting a new one (via BullMQ `getActiveCount()`)
2. **`triggerWorker()`**: Also call on job `failed` event (automatic retry)
3. **`start-worker.ts`**: Add `--restart` flag that auto-restarts the worker process if it exits with non-zero code

- [ ] **Step 1:** Read `scripts/start-worker.ts` and `src/lib/queue.ts`
- [ ] **Step 2:** In `start-worker.ts`, add deduplication check:
  - Before spawning worker, check `queue.getActiveCount()` and `queue.getWaitingCount()`
  - If there are active jobs AND no waiting jobs, a worker is already processing — skip spawn
  - If there are waiting/failed jobs and no active workers, spawn a new worker
- [ ] **Step 3:** In `start-worker.ts`, add auto-restart on crash:
  - Listen for child process `exit` event
  - If exit code is non-zero and there are still pending jobs, respawn the worker
  - Add max restart count (3) to prevent infinite loops
- [ ] **Step 4:** In `src/lib/queue.ts`, add `triggerWorker()` call on job `failed` event in `enqueueVideoJob`:
  ```typescript
  // After adding job to queue, also trigger worker in case it crashed
  await triggerWorker().catch(() => undefined);
  ```
  Note: This is already done in the video POST route, but adding it to the queue level ensures retries also trigger the worker.
- [ ] **Step 5:** Run targeted ESLint on modified files
- [ ] **Step 6:** Commit: `fix(worker): add auto-restart and deduplication for resilient on-demand processing`

---

## Task 7: Fix Purchase Flow — Show After Upload + Correct Duration

**Files:**
- Investigate: `src/components/upload/VideoUploadFlow.tsx` or similar upload component
- Investigate: `src/components/billing/AvulsoCalculator.tsx` or similar
- Investigate: Upload page component

**Root Cause:** The "compra avulsa" (single purchase) section is shown before the video is uploaded and its duration is known. The duration calculation may also be wrong.

- [ ] **Step 1:** Find and read the upload page/component that shows the purchase section
- [ ] **Step 2:** Find and read the AvulsoCalculator component
- [ ] **Step 3:** Identify how video duration is calculated and passed to the calculator
- [ ] **Step 4:** Move the purchase section to only appear after the video file is loaded and its duration is known
- [ ] **Step 5:** Fix the duration calculation to use the actual video duration from the file metadata
- [ ] **Step 6:** Run targeted ESLint
- [ ] **Step 7:** Commit: `fix(upload): show purchase section only after video load with correct duration`

---

## Task 8: Verify Video Preview Works After URL Signing

**Files:**
- Verify: `src/components/editor/VideoEditor.tsx` or similar

**Root Cause:** Same as Bug #2 — the video preview was crashing because the URL returned 401. After Task 1 fixes the URL signing, the preview should work.

- [ ] **Step 1:** After Task 1 is complete, verify that `GET /api/videos/[id]` returns signed URLs
- [ ] **Step 2:** Check the video preview component to ensure it uses the signed URL from the API response
- [ ] **Step 3:** If the preview component constructs URLs differently (e.g., using `processedUrl` directly from a different source), fix it to use the signed URL
- [ ] **Step 4:** Commit: `fix(preview): ensure video preview uses signed URLs` (only if changes needed)

---

## Execution Order

Tasks 1, 2, 3, and 4 are independent and can be parallelized.
Tasks 5 and 7 are independent and can be parallelized.
Task 6 is independent.
Task 8 depends on Task 1.

**Recommended parallel groups:**
- Group A: Tasks 1, 2, 3 (independent, high priority)
- Group B: Tasks 4, 5, 6 (independent, medium priority)
- Group C: Task 7 (independent, medium priority)
- Group D: Task 8 (depends on Task 1)

**No subagent may run `npm run build`, `next build`, or `pg_ctl start`. Only the orchestrator may run the final build.**