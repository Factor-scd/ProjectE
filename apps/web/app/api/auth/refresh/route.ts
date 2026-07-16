import { NextRequest, NextResponse } from 'next/server';
import { createPocketBaseClient } from '@/lib/pocketbase';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('pb_auth')?.value;

    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'No auth token' } },
        { status: 401 }
      );
    }

    const pb = createPocketBaseClient(token);

    // Refresh the auth token
    await pb.collection('users').authRefresh();

    const newToken = pb.authStore.token;

    const response = NextResponse.json({
      token: newToken,
    });

    response.cookies.set('pb_auth', newToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: { code: 'AUTH_ERROR', message: 'Token refresh failed' } },
      { status: 401 }
    );
  }
}
