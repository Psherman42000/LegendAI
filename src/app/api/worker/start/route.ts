import { NextResponse } from "next/server";
import { startDetachedWorker } from "@/lib/worker-spawn";

/**
 * POST /api/worker/start
 *
 * On-demand worker start endpoint. Requires a `WORKER_SECRET` to be configured
 * in env. When valid, spawns `src/workers/videoProcessor.ts` as a detached
 * child process.
 *
 * Returns 503 if WORKER_SECRET is not configured.
 * Returns 401 if the provided secret does not match.
 * Returns 200 on successful spawn.
 */
export async function POST(request: Request) {
  // Guard: require WORKER_SECRET to be configured
  if (!process.env.WORKER_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Worker secret not configured" },
      { status: 503 },
    );
  }

  // Guard: do not spawn on Vercel serverless
  if (process.env.VERCEL) {
    return NextResponse.json(
      { ok: false, error: "Cannot start worker on Vercel" },
      { status: 503 },
    );
  }

  // Validate secret from request body
  let body: { secret?: string };
  try {
    body = (await request.json()) as { secret?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.secret || body.secret !== process.env.WORKER_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Invalid worker secret" },
      { status: 401 },
    );
  }

  const result = startDetachedWorker({
    onError(error) {
      console.error("[api/worker/start] Failed to spawn worker:", error);
    },
  });

  if (!result.ok) {
    console.error(`[api/worker/start] ${result.error}`);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  console.log(`[api/worker/start] Worker spawned (PID ${result.pid})`);

  return NextResponse.json({
    ok: true,
    pid: result.pid,
    message: "Worker started",
  });
}
