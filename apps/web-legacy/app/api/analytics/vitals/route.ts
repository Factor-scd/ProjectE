// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

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
