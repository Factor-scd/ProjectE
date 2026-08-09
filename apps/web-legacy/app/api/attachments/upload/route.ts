// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// POST /api/attachments/upload — Upload file attachment
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('task_id') as string | null;

    if (!file) {
      return createErrorResponse('VALIDATION_ERROR', 'File is required', 400);
    }

    if (!taskId) {
      return createErrorResponse('VALIDATION_ERROR', 'task_id is required', 400);
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return createErrorResponse('FILE_TOO_LARGE', 'File size must be less than 5MB', 400);
    }

    const pb = createPocketBaseClient();

    // Upload to PocketBase
    const attachment = await pb.collection('task_attachments').create({
      task_id: taskId,
      file,
      filename: file.name,
      mime_type: file.type,
      size: file.size,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch {
    return createErrorResponse('UPLOAD_FAILED', 'Failed to upload file', 500);
  }
});
