import { NextRequest, NextResponse } from 'next/server';
import { createPocketBaseClient } from './pocketbase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Extract auth token from request cookies
 */
export function getAuthToken(request: NextRequest): string | null {
  return request.cookies.get('pb_auth')?.value || null;
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = getAuthToken(request);
  if (!token) return null;

  try {
    const pb = createPocketBaseClient(token);
    const authData = await pb.collection('users').authRefresh();

    return {
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name || authData.record.email,
    };
  } catch {
    return null;
  }
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

      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' } },
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
