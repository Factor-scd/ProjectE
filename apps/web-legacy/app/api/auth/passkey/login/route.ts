// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@project-e/db';
import { eq } from 'drizzle-orm';

// POST /api/auth/passkey/login — Verify passkey login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credentialId, signature, authenticatorData, clientDataJSON } = body;

    if (!credentialId || !signature) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'credentialId and signature are required' } },
        { status: 400 }
      );
    }

    // Find user by credential ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passkeyCredentialId, credentialId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Passkey not found' } },
        { status: 401 }
      );
    }

    // In production, verify the WebAuthn assertion here using SimpleWebAuthn
    // For now, we accept the passkey and return the user info
    // The actual verification will be implemented with @simplewebauthn/server

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('[passkey/login] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to verify passkey' } },
      { status: 500 }
    );
  }
}
