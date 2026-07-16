import { NextRequest, NextResponse } from 'next/server';

// POST /api/analytics/vitals — Receive Web Vitals metrics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', body);
    }

    // In production, this would send to your analytics service
    // (e.g., Google Analytics, PostHog, or custom backend)
    // For now, just acknowledge receipt

    return NextResponse.json({ received: true });
  } catch {
    // Silently ignore malformed requests
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
