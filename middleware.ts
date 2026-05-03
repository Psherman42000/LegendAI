import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const windowMs = 60_000;
const maxRequests = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth", "/api/health"];
const STATIC_PATHS = ["/_next", "/favicon.ico", "/public"];

function isPublic(path: string): boolean {
  if (STATIC_PATHS.some((p) => path.startsWith(p))) return true;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return true;
  return false;
}

function rateLimit(ip: string): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= maxRequests) {
    return NextResponse.json({ ok: false, error: "Rate limit excedido" }, { status: 429 });
  }

  bucket.count += 1;
  buckets.set(ip, bucket);
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResponse = rateLimit(ip);
  if (rateLimitResponse) return rateLimitResponse;

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
