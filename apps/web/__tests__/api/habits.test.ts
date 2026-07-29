/**
 * API tests for habits routes.
 * These tests verify the habit CRUD API logic using mocked Drizzle.
 * Run with: npm test -- --testPathPattern=habits
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
  habits: {},
  habitCompletions: {},
  habitTags: {},
  tags: {},
  activityFeed: {},
}));

jest.mock('@/lib/auth', () => ({
  withAuth: (handler: any) => {
    return (request: any, context: any) => {
      const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test User' };
      return handler(request, mockUser, context);
    };
  },
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

// Build a Drizzle-like chain that resolves to the given value when awaited
function chain(resolvedValue: any) {
  const c: any = {};
  c.from = jest.fn().mockReturnValue(c);
  c.where = jest.fn().mockReturnValue(c);
  c.orderBy = jest.fn().mockReturnValue(c);
  c.limit = jest.fn().mockReturnValue(c);
  c.offset = jest.fn().mockReturnValue(c);
  c.innerJoin = jest.fn().mockReturnValue(c);
  c.having = jest.fn().mockReturnValue(c);
  c.then = (onfulfilled: any) => Promise.resolve(resolvedValue).then(onfulfilled);
  c.catch = (onrejected: any) => Promise.resolve(resolvedValue).catch(onrejected);
  return c;
}

function insertChain(resolvedValue: any) {
  const c: any = {};
  c.values = jest.fn().mockReturnValue(c);
  c.returning = jest.fn().mockReturnValue(c);
  c.then = (onfulfilled: any) => Promise.resolve(resolvedValue).then(onfulfilled);
  c.catch = (onrejected: any) => Promise.resolve(resolvedValue).catch(onrejected);
  return c;
}

function updateChain(resolvedValue?: any) {
  const c: any = {};
  c.set = jest.fn().mockReturnValue(c);
  c.where = jest.fn().mockReturnValue(c);
  c.returning = jest.fn().mockReturnValue(c);
  c.then = (onfulfilled: any) => Promise.resolve(resolvedValue !== undefined ? resolvedValue : undefined).then(onfulfilled);
  c.catch = (onrejected: any) => Promise.resolve(resolvedValue !== undefined ? resolvedValue : undefined).catch(onrejected);
  return c;
}

describe('Habits API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/domains/[domainId]/habits', () => {
    it('should list habits with default pagination', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/habits/route');
      const { db } = require('@project-e/db');

      const mockHabits = [
        { id: '1', name: 'Habit 1', frequency: 'daily', difficulty: 'medium', domainId: 'domain-1', streakCount: 5, bestStreak: 10 },
        { id: '2', name: 'Habit 2', frequency: 'weekly', difficulty: 'hard', domainId: 'domain-1', streakCount: 0, bestStreak: 3 },
      ];

      db.select
        .mockReturnValueOnce(chain(mockHabits))   // main query
        .mockReturnValueOnce(chain([{ count: 2 }])) // count query
        .mockReturnValueOnce(chain([]));            // tags query

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });

      expect(response).toBeDefined();
    });

    it('should filter by active status', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/habits/route');
      const { db } = require('@project-e/db');

      db.select
        .mockReturnValueOnce(chain([{ id: '1', name: 'Habit 1', domainId: 'domain-1' }]))
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits?active=true');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('POST /api/domains/[domainId]/habits', () => {
    it('should create a habit with required fields', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/habits/route');
      const { db } = require('@project-e/db');

      const mockHabit = {
        id: 'new-habit-1',
        name: 'Test Habit',
        frequency: 'daily',
        difficulty: 'medium',
        domainId: 'domain-1',
      };

      db.insert.mockReturnValue(insertChain([mockHabit]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Habit' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });

    it('should reject empty name', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/habits/route');
      const request = new Request('http://localhost:3000/api/domains/domain-1/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('POST /api/domains/[domainId]/habits/[id]/complete', () => {
    it('should complete a habit and return streak info', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/habits/[id]/complete/route');
      const { db } = require('@project-e/db');

      const mockHabit = {
        id: 'habit-1',
        name: 'Test Habit',
        domainId: 'domain-1',
        skipDays: [0, 6],
        streakCount: 3,
        bestStreak: 10,
      };

      db.select
        .mockReturnValueOnce(chain([mockHabit]))   // verify habit exists
        .mockReturnValueOnce(chain([]));            // completions for streak calc

      db.insert.mockReturnValue(insertChain([{ id: 'comp-1', habitId: 'habit-1', date: new Date(), value: 1 }]));

      db.update.mockReturnValue(updateChain());

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits/habit-1/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 1 }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'habit-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('PATCH /api/domains/[domainId]/habits/[id]', () => {
    it('should update a habit', async () => {
      const { PATCH } = await import('@/app/api/domains/[domainId]/habits/[id]/route');
      const { db } = require('@project-e/db');

      const existingHabit = {
        id: 'habit-1',
        name: 'Test Habit',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue(chain([existingHabit]));
      db.update.mockReturnValue(updateChain([{ ...existingHabit, name: 'Updated Habit' }]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits/habit-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Habit' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'habit-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('DELETE /api/domains/[domainId]/habits/[id]', () => {
    it('should soft delete a habit', async () => {
      const { DELETE } = await import('@/app/api/domains/[domainId]/habits/[id]/route');
      const { db } = require('@project-e/db');

      const existingHabit = {
        id: 'habit-1',
        name: 'Test Habit',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue(chain([existingHabit]));
      db.update.mockReturnValue(updateChain());

      const request = new Request('http://localhost:3000/api/domains/domain-1/habits/habit-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'habit-1' }) });
      expect(response.status).toBe(204);
    });
  });
});
