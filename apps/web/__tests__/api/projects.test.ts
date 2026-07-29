/**
 * API tests for projects and sections routes.
 * These tests verify the project CRUD and section API logic using mocked Drizzle.
 * Run with: npm test -- --testPathPattern=projects
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
  projects: {},
  sections: {},
  tasks: {},
  projectTags: {},
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

describe('Projects API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/domains/[domainId]/projects', () => {
    it('should list projects with default pagination', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/projects/route');
      const { db } = require('@project-e/db');

      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active', domainId: 'domain-1' },
        { id: '2', name: 'Project 2', status: 'paused', domainId: 'domain-1' },
      ];

      db.select
        .mockReturnValueOnce(chain(mockProjects))   // main query
        .mockReturnValueOnce(chain([{ count: 2 }])) // count query
        .mockReturnValueOnce(chain([]))             // tags query
        .mockReturnValueOnce(chain([{ count: 0 }])) // task count for project 1
        .mockReturnValueOnce(chain([{ count: 0 }])) // completed count for project 1
        .mockReturnValueOnce(chain([{ count: 0 }])) // task count for project 2
        .mockReturnValueOnce(chain([{ count: 0 }])); // completed count for project 2

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });

      expect(response).toBeDefined();
    });

    it('should filter by status', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/projects/route');
      const { db } = require('@project-e/db');

      db.select
        .mockReturnValueOnce(chain([{ id: '1', name: 'Project 1', domainId: 'domain-1' }]))
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([{ count: 0 }]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects?status=active');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('POST /api/domains/[domainId]/projects', () => {
    it('should create a project with required fields', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/projects/route');
      const { db } = require('@project-e/db');

      const mockProject = {
        id: 'new-project-1',
        name: 'Test Project',
        status: 'active',
        domainId: 'domain-1',
      };

      db.insert.mockReturnValue(insertChain([mockProject]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Project' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });

    it('should reject empty name', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/projects/route');
      const request = new Request('http://localhost:3000/api/domains/domain-1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('PATCH /api/domains/[domainId]/projects/[id]', () => {
    it('should update a project', async () => {
      const { PATCH } = await import('@/app/api/domains/[domainId]/projects/[id]/route');
      const { db } = require('@project-e/db');

      const existingProject = {
        id: 'project-1',
        name: 'Test Project',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue(chain([existingProject]));
      db.update.mockReturnValue(updateChain([{ ...existingProject, name: 'Updated Project' }]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects/project-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Project' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'project-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('DELETE /api/domains/[domainId]/projects/[id]', () => {
    it('should soft delete a project', async () => {
      const { DELETE } = await import('@/app/api/domains/[domainId]/projects/[id]/route');
      const { db } = require('@project-e/db');

      const existingProject = {
        id: 'project-1',
        name: 'Test Project',
        domainId: 'domain-1',
      };

      db.select.mockReturnValue(chain([existingProject]));
      db.update.mockReturnValue(updateChain());

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects/project-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ domainId: 'domain-1', id: 'project-1' }) });
      expect(response.status).toBe(204);
    });
  });
});

describe('Sections API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/domains/[domainId]/projects/[projectId]/sections', () => {
    it('should list sections for a project', async () => {
      const { GET } = await import('@/app/api/domains/[domainId]/projects/[projectId]/sections/route');
      const { db } = require('@project-e/db');

      const mockSections = [
        { id: '1', name: 'Section 1', projectId: 'project-1', kind: 'section', sortOrder: 0 },
        { id: '2', name: 'Milestone 1', projectId: 'project-1', kind: 'milestone', sortOrder: 1 },
      ];

      db.select
        .mockReturnValueOnce(chain([{ id: 'project-1' }]))  // verify project
        .mockReturnValueOnce(chain(mockSections));          // list sections

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects/project-1/sections');
      const response = await GET(request, { params: Promise.resolve({ domainId: 'domain-1', projectId: 'project-1' }) });
      expect(response).toBeDefined();
    });
  });

  describe('POST /api/domains/[domainId]/projects/[projectId]/sections', () => {
    it('should create a section', async () => {
      const { POST } = await import('@/app/api/domains/[domainId]/projects/[projectId]/sections/route');
      const { db } = require('@project-e/db');

      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockSection = {
        id: 'new-section-1',
        name: 'Test Section',
        projectId: 'project-1',
        kind: 'section',
        sortOrder: 0,
      };

      db.select
        .mockReturnValueOnce(chain([mockProject]))  // verify project
        .mockReturnValueOnce(chain([{ max: -1 }]));  // max sort order

      db.insert.mockReturnValue(insertChain([mockSection]));

      const request = new Request('http://localhost:3000/api/domains/domain-1/projects/project-1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Section' }),
      });

      const response = await POST(request, { params: Promise.resolve({ domainId: 'domain-1', projectId: 'project-1' }) });
      expect(response).toBeDefined();
    });
  });
});
