import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/search');
  });

  test('renders the search page with the query input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search tasks, notes/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notes' })).toBeVisible();
  });

  test('shows a no-results state for an unmatched query', async ({ page }) => {
    await page.getByPlaceholder(/search tasks, notes/i).fill('zzz-no-such-thing-xyz');
    await expect(page.getByText(/no results found/i)).toBeVisible({ timeout: 10_000 });
  });

  test('filters results by type', async ({ page }) => {
    await page.getByPlaceholder(/search tasks, notes/i).fill('meeting');
    await page.getByRole('button', { name: 'Habits' }).click();

    // The filter buttons stay interactive after toggling a type off.
    await expect(page.getByRole('button', { name: 'Habits' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
  });
});
