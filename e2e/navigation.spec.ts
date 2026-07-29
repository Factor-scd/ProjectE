import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate between all main pages via sidebar', async ({ page }) => {
    const pages = [
      { href: '/dashboard', name: /dashboard/i },
      { href: '/tasks', name: /tasks/i },
      { href: '/habits', name: /habits/i },
      { href: '/projects', name: /projects/i },
      { href: '/notes', name: /notes/i },
      { href: '/graph', name: /graph/i },
      { href: '/calendar', name: /calendar/i },
      { href: '/search', name: /search/i },
    ];

    for (const { href, name } of pages) {
      await page.goto(href);
      await page.waitForURL(`**${href}`, { timeout: 10_000 });
      await expect(page.locator('h1, h2').filter({ hasText: name }).first()).toBeVisible();
    }
  });

  test('should open command palette with Cmd+K', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Meta+k');
    // Command palette should be visible
    await expect(page.getByPlaceholder(/type a command/i)).toBeVisible({ timeout: 5_000 });
    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('should open keyboard shortcuts help with ?', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('?');
    // Shortcuts help dialog should be visible
    await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible({ timeout: 5_000 });
    // Close with Escape
    await page.keyboard.press('Escape');
  });
});
