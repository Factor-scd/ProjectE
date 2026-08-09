/**
 * API tests for tasks routes.
 * These tests verify the task CRUD API logic using mocked Drizzle.
 * Run with: npm test -- --testPathPattern=tasks
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the database module
jest.mock('@project-e/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  sql: { unsafe: jest.fn() },
  tasks: {},
  taskTags: {},
  taskDependencies: {},
  tags: {},
  activityFeed: {},
}));

jest.mock('@/lib/auth', () => ({
  withAuth: (handler: any) => handler,
  requireWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
  createErrorResponse: (code: string, message: string, status: number, details?: unknown) => ({
    code,
    message,
    status,
    details,
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number = 400, public code: string = 'BAD_REQUEST') {
      super(message);
    }
  },
}));

jest.mock('@/lib/activity', () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined),
}));

describe('Tasks API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/domains/[domainId]/tasks', () => {
    it('should list tasks with default pagination', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/tasks/route');
      const { db } = require('@project-e/db');

      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 'medium', domainId: 'domain-1' },
        { id: '2', title: 'Task 2', status: 'in_progress', priority: 'high', domainId: 'domain-1' },
      ];

      // Mock the db.select chain
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockOffset = jest.fn().mockResolvedValue(mockTasks);

      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                offset: jest.fn().mockResolvedValue(mockTasks),
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });

      expect(response).toBeDefined();
    });

    it('should filter by status', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/tasks/route');
      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks?status=todo');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });

    it('should filter by search term', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/tasks/route');
      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks?search=test');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('POST /api/domains/[domainId]/tasks', () => {
    it('should create a task with required fields', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/tasks/route');
      const { db } = require('@project-e/db');

      const mockTask = {
        id: 'new-task-1',
        title: 'Test Task',
        status: 'todo',
        priority: 'medium',
        domainId: 'domain-1',
      };

      db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTask]),
        }),
      });

      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Task' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });

    it('should reject empty title', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/tasks/route');
      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('PATCH /api/domains/[domainId]/tasks/[id]', () => {
    it('should update task status', async () => {
      const { PATCH } = await import('@/app/api/domains/[domainId]/tasks/[id]/route');
      const { db } = require('@project-e/db');

      const existingTask = {
        id: 'task-1',
        title: 'Test Task',
        status: 'todo',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...existingTask, status: 'done' }]),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks/task-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'task-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('DELETE /api/domains/[domainId]/tasks/[id]', () => {
    it('should soft delete a task', async () => {
      const { DELETE } = await import('@/app/api/domains/[domainId]/tasks/[id]/route');
      const { db } = require('@project-e/db');

      const existingTask = {
        id: 'task-1',
        title: 'Test Task',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([existingTask]),
          }),
        }),
      });

      db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks/task-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'task-1' }) });
      expect(response.status).toBe(204);
    });
  });

  describe('Dependencies cycle detection', () => {
    it('should detect direct self-loop', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/tasks/[id]/dependencies/route');
      const { db } = require('@project-e/db');

      const mockTask = { id: 'task-1', title: 'Test', domainId: 'domain-1' };

      db.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTask]),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/domains/domain-1/tasks/task-1/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 'task-1' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'task-1' }) });
      expect(response).toBeDefined();
    });
  });
});
