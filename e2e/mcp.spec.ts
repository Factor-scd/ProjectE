import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('MCP Server', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('server/discover should return all expected tools', async ({ page }) => {
    const response = await page.request.post('/api/mcp', {
      data: {
        jsonrpc: '2.0',
        method: 'server/discover',
        id: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.result).toBeDefined();
    expect(body.result.name).toBe('project-e');
    expect(body.result.tools).toBeDefined();
    expect(Array.isArray(body.result.tools)).toBeTruthy();

    // Verify expected tools exist
    const toolNames = body.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('tasks.list');
    expect(toolNames).toContain('tasks.create');
    expect(toolNames).toContain('tasks.update');
    expect(toolNames).toContain('tasks.delete');
    expect(toolNames).toContain('tasks.complete');
    expect(toolNames).toContain('habits.list');
    expect(toolNames).toContain('habits.create');
    expect(toolNames).toContain('habits.complete');
    expect(toolNames).toContain('projects.list');
    expect(toolNames).toContain('projects.create');
    expect(toolNames).toContain('notes.list');
    expect(toolNames).toContain('notes.create');
    expect(toolNames).toContain('notes.update');
    expect(toolNames).toContain('notes.search');
    expect(toolNames).toContain('domains.list');
    expect(toolNames).toContain('domains.create');
    expect(toolNames).toContain('search.query');
    expect(toolNames).toContain('activity.list');
  });

  test('should reject unauthenticated requests', async ({ page }) => {
    const response = await page.request.post('/api/mcp', {
      data: {
        jsonrpc: '2.0',
        method: 'server/discover',
        id: 1,
      },
    });

    // Without API key, should return 401
    expect(response.status()).toBe(401);
  });

  test('should return error for unknown method', async ({ page }) => {
    const response = await page.request.post('/api/mcp', {
      data: {
        jsonrpc: '2.0',
        method: 'unknown.method',
        id: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(-32601); // METHOD_NOT_FOUND
  });

  test('should reject invalid JSON-RPC request', async ({ page }) => {
    const response = await page.request.post('/api/mcp', {
      data: { invalid: true },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('GET should return 405', async ({ page }) => {
    const response = await page.request.get('/api/mcp');
    expect(response.status()).toBe(405);
  });
});
