import { NextRequest, NextResponse } from "next/server";

const windowMs = 60_000;
const maxRequests = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired rate-limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(ip);
  }
}, windowMs);

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth", "/api/health", "/api/worker/start"];
const STATIC_PATHS = ["/_next", "/favicon.ico", "/uploads", "/ffmpeg"];

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
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { ok: false, error: "Rate limit excedido" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  bucket.count += 1;
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  // NOTE: This is a shallow cookie existence check — route handlers still
  // validate the actual session via getServerSession(). The cookie check
  // prevents unauthenticated requests from reaching the handler, reducing
  // load, but does not replace server-side session validation.
  const sessionToken = request.cookies.get("next-auth.session-token")?.value
    ?? request.cookies.get("__Secure-next-auth.session-token")?.value;
  if (!sessionToken) {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const rateLimitResponse = rateLimit(ip);
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
