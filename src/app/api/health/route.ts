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
