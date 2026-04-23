import { NextRequest, NextResponse } from "next/server";

const windowMs = 60_000;
const maxRequests = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/billing")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return NextResponse.next();
  }

  if (bucket.count >= maxRequests) {
    return NextResponse.json({ ok: false, error: "Rate limit excedido" }, { status: 429 });
  }

  bucket.count += 1;
  buckets.set(ip, bucket);
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/billing/:path*"],
};
