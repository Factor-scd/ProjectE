import { NextRequest, NextResponse } from 'next/server';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const pb = createPocketBaseClient();

    // Authenticate with PocketBase
    const authData = await pb.collection('users').authWithPassword(email, password);

    // Set auth token in httpOnly cookie
    const response = NextResponse.json({
      user: {
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name || authData.record.email,
      },
      token: authData.token,
    });

    response.cookies.set('pb_auth', authData.token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'AUTH_ERROR', message: 'Invalid email or password' } },
      { status: 401 }
    );
  }
}
