import { NextRequest, NextResponse } from 'next/server';
import { createPocketBaseClient } from '@/lib/pocketbase';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('pb_auth')?.value;

    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const pb = createPocketBaseClient(token);

    // Get current user
    const authData = await pb.collection('users').authRefresh();

    return NextResponse.json({
      user: {
        id: authData.record.id,
        email: authData.record.email,
        name: authData.record.name || authData.record.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'AUTH_ERROR', message: 'Invalid or expired token' } },
      { status: 401 }
    );
  }
}
