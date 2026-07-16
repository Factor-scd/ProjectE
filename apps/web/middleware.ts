import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user is authenticated
  const token = request.cookies.get('pb_auth')?.value;

  // If no token and trying to access protected routes, redirect to login
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
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
