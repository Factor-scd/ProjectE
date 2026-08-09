/**
 * Unit tests for resolveActiveDomain helper in lib/auth.ts.
 * Tests both branches: existing domain returned, and auto-creation of "Personal" domain.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the database module
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
};
const mockDomains = {};

jest.mock('@project-e/db', () => ({
  db: mockDb,
  domains: mockDomains,
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock next-auth config
jest.mock('@/lib/auth-config', () => ({
  authOptions: {},
}));

describe('resolveActiveDomain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the user\'s first existing domain without creating one', async () => {
    const { resolveActiveDomain } = await import('@/lib/auth');

    const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
    const mockDomain = { id: 'domain-1', name: 'Work' };

    // Mock the select chain to return an existing domain
    const mockLimit = jest.fn().mockResolvedValue([mockDomain]);
    const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const result = await resolveActiveDomain(mockUser);

    expect(result).toEqual({ id: 'domain-1', name: 'Work', created: false });
    expect(mockDb.select).toHaveBeenCalledWith({ id: expect.anything(), name: expect.anything() });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should create a "Personal" domain when the user has none', async () => {
    const { resolveActiveDomain } = await import('@/lib/auth');

    const mockUser = { id: 'user-2', email: 'new@example.com', name: 'New User' };
    const mockCreatedDomain = { id: 'new-domain-id', name: 'Personal' };

    // First call: no existing domain
    const mockLimit1 = jest.fn().mockResolvedValue([]);
    const mockOrderBy1 = jest.fn().mockReturnValue({ limit: mockLimit1 });
    const mockWhere1 = jest.fn().mockReturnValue({ orderBy: mockOrderBy1 });
    const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 });
    mockDb.select.mockReturnValue({ from: mockFrom1 });

    // Insert returns the created domain
    const mockReturning = jest.fn().mockResolvedValue([mockCreatedDomain]);
    const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
    mockDb.insert.mockReturnValue({ values: mockValues });

    const result = await resolveActiveDomain(mockUser);

    expect(result).toEqual({ id: 'new-domain-id', name: 'Personal', created: true });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-2',
      name: 'Personal',
      sortOrder: 0,
    }));
  });
});
