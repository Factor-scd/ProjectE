import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user is authenticated
  const token = request.cookies.get('next-auth.session-token')?.value
    || request.cookies.get('__Secure-next-auth.session-token')?.value;

  // Protected routes (v1 + v2)
  const protectedRoutes = [
    '/dashboard', '/tasks', '/habits', '/projects', '/notes', '/reports',
    '/calendar', '/analytics', '/agents', '/settings',
    '/graph', '/domains',
  ];
  if (!token && protectedRoutes.some((route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`))) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Create response
  const response = NextResponse.next();

  // Forward proxy headers for proper client IP detection
  // Nginx Proxy Manager sets X-Forwarded-For and X-Forwarded-Proto
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
