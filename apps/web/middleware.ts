import { NextRequest, NextResponse } from 'next/server';

// ── Token bucket rate limiter ─────────────────────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

// REST API: 100 req/min, MCP: 300 req/min
const RATE_LIMITS: Record<string, { maxTokens: number; refillMs: number }> = {
  rest: { maxTokens: 100, refillMs: 60000 },
  mcp: { maxTokens: 300, refillMs: 60000 },
};

function getBucketKey(request: NextRequest): string {
  // Use API key if present, otherwise IP
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (apiKey) return `apikey:${apiKey}`;

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1';
  return `ip:${ip}`;
}

function getRateLimitType(request: NextRequest): 'mcp' | 'rest' {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/mcp') return 'mcp';
  return 'rest';
}

function checkRateLimit(request: NextRequest): { allowed: boolean; limit: number; remaining: number; resetMs: number } {
  const key = getBucketKey(request);
  const type = getRateLimitType(request);
  const config = RATE_LIMITS[type];
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / config.refillMs) * config.maxTokens;
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  const allowed = bucket.tokens >= 1;
  if (allowed) {
    bucket.tokens -= 1;
  }

  // Calculate reset time
  const resetMs = bucket.lastRefill + config.refillMs;

  return {
    allowed,
    limit: config.maxTokens,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    resetMs,
  };
}

// Periodically clean up stale buckets (every 5 minutes)
// Edge Runtime cleanup (no .unref support)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > 120000) { // 2 minutes stale
      buckets.delete(key);
    }
  }
}, 300000);

// ── Excluded routes ──────────────────────────────────────────────────────────────

const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/realtime',
  '/api/auth',
  '/_next',
  '/favicon.ico',
];

function isExcluded(pathname: string): boolean {
  return EXCLUDED_ROUTES.some(route => pathname.startsWith(route));
}

// ── Middleware ────────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for excluded routes
  if (isExcluded(pathname)) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const token = request.cookies.get('next-auth.session-token')?.value
    || request.cookies.get('__Secure-next-auth.session-token')?.value;

  // If no token and trying to access protected routes, redirect to login
  const protectedRoutes = [
    '/dashboard', '/tasks', '/habits', '/projects', '/notes', '/reports',
    '/calendar', '/analytics', '/agents', '/settings',
  ];
  if (!token && protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const result = checkRateLimit(request);

    const response = result.allowed
      ? NextResponse.next()
      : NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
          { status: 429 }
        );

    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));

    return response;
  }

  // Create response for non-API routes
  const response = NextResponse.next();

  // Forward proxy headers for proper client IP detection
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedFor) {
    response.headers.set('x-real-ip', forwardedFor.split(',')[0].trim());
  }

  if (forwardedProto) {
    response.headers.set('x-forwarded-proto', forwardedProto);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth routes (login, logout, etc.)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (public folder)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
