// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-config';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
