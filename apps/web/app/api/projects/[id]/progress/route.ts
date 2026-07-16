import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { computeProjectProgress } from '@/lib/services/project-service';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/progress — Get project progress
export const GET = withAuth<RouteContext>(async (_request: NextRequest, _user, context) => {
  const { id } = await context!.params;
  const progress = await computeProjectProgress(id);
  return NextResponse.json({ progress });
});
