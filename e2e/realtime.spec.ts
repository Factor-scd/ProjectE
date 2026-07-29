import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Realtime Updates', () => {
  test('should connect to SSE endpoint', async ({ page }) => {
    await login(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // The SSE connection is established automatically via the realtime hook
    // Verify the page loaded without errors
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Check for SSE-related errors
    const sseErrors = consoleMessages.filter(
      (m) => m.includes('realtime') || m.includes('SSE') || m.includes('EventSource')
    );
    expect(sseErrors.length).toBe(0);
  });

  test('should have realtime API endpoint', async ({ page }) => {
    const response = await page.request.get('/api/realtime');
    // SSE endpoint should return 200 with text/event-stream content type
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/event-stream');
  });
});
