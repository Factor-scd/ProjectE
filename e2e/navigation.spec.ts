import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('every primary route renders its page', async ({ page }) => {
    const pages = [
      { url: '/', check: page.getByRole('heading', { name: /dashboard/i }) },
      { url: '/tasks', check: page.getByRole('heading', { name: /tasks/i }) },
      { url: '/habits', check: page.getByRole('heading', { name: /habits/i }) },
      { url: '/projects', check: page.getByRole('heading', { name: /projects/i }) },
      { url: '/notes', check: page.getByRole('button', { name: /new note/i }) },
      { url: '/calendar', check: page.getByRole('heading', { name: /calendar/i }) },
      { url: '/graph', check: page.getByPlaceholder(/find a node/i) },
      { url: '/search', check: page.getByPlaceholder(/search tasks, notes/i) },
      { url: '/analytics', check: page.getByRole('heading', { name: /analytics/i }) },
      { url: '/agents/activity', check: page.getByRole('heading', { name: /agent activity/i }) },
      { url: '/daily', check: page.getByRole('button', { name: /today/i }) },
      { url: '/settings', check: page.getByRole('button', { name: 'Appearance' }) },
    ];

    for (const { url, check } of pages) {
      await page.goto(url);
      await page.waitForURL(`**${url}`, { timeout: 10_000 });
      await expect(check).toBeVisible({ timeout: 10_000 });
    }
  });

  test('navigates via the sidebar links', async ({ page }) => {
    // The sidebar is desktop-only; on narrow viewports it lives behind the
    // topbar menu button.
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'sidebar is hidden on mobile');

    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Tasks' }).click();
    await page.waitForURL('**/tasks', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible();

    await nav.getByRole('link', { name: 'Habits' }).click();
    await page.waitForURL('**/habits', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /habits/i })).toBeVisible();

    await nav.getByRole('link', { name: 'Settings' }).click();
    await page.waitForURL('**/settings', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Appearance' })).toBeVisible();
  });
});
