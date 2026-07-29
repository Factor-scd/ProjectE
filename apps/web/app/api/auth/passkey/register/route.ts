// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db, users } from '@project-e/db';
import { eq } from 'drizzle-orm';

// POST /api/auth/passkey/register — Start passkey registration
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credentialId, publicKey, counter } = body;

    if (!credentialId || !publicKey) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'credentialId and publicKey are required' } },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        passkeyCredentialId: credentialId,
        passkeyPublicKey: publicKey,
        passkeyCounter: counter ?? 0,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[passkey/register] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to register passkey' } },
      { status: 500 }
    );
  }
}
