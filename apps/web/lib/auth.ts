import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth-config';
import { db, domains } from '@project-e/db';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Extract auth token from request cookies
 */
export function getAuthToken(request: NextRequest): string | null {
  return request.cookies.get('next-auth.session-token')?.value
    || request.cookies.get('__Secure-next-auth.session-token')?.value
    || null;
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  if (!getAuthToken(request)) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name || session.user.email };
}

/**
 * Require authentication — throws if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError('Not authenticated', 401);
  }
  return user;
}

/**
 * Require workspace access — verifies the workspace exists and user has access
 */
export async function requireWorkspaceAccess(workspaceId: string): Promise<void> {
  const [domain] = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.id, workspaceId))
    .limit(1);

  if (!domain) {
    throw new AuthError('Workspace not found', 404, 'NOT_FOUND');
  }
}

/**
 * Auth middleware for API routes
 * Wraps a route handler and ensures authentication
 */

// Overload: when context type T is provided, context is required in both handler and return
export function withAuth<T>(
  handler: (request: NextRequest, user: AuthUser, context: T) => Promise<NextResponse>
): (request: NextRequest, context: T) => Promise<NextResponse>;

// Overload: no context type — context param is not passed
export function withAuth(
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse>;

// Implementation
export function withAuth<T>(
  handler: (request: NextRequest, user: AuthUser, context?: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      const user = await requireAuth(request);
      return await handler(request, user, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status }
        );
      }

      console.error('[withAuth] error:', error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Auth error: ' + (error instanceof Error ? error.message : String(error)) } },
        { status: 500 }
      );
    }
  };
}

/**
 * Custom error class for auth errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
    public code: string = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * API error class for consistent error responses
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'BAD_REQUEST',
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to create error responses
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}
