import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Agent Activity', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/agents/activity');
    await expect(page.getByRole('heading', { name: /agent activity/i })).toBeVisible();
  });

  test('renders the filter bar and refresh button', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: /all agents/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /all actions/i })).toBeVisible();
    await expect(page.getByPlaceholder('From')).toBeVisible();
    await expect(page.getByPlaceholder('To')).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
  });

  test('renders the timeline area', async ({ page }) => {
    // The initial activity query settles to either the empty state or a row of
    // live/fetched activity entries.
    const emptyState = page.getByText(/no activity found/i);
    const activityEntry = page.getByText(/created|updated|deleted|completed/i).last();

    await expect(emptyState.or(activityEntry)).toBeVisible({ timeout: 10_000 });
  });

  test('filters by action type', async ({ page }) => {
    await page.getByRole('combobox', { name: /all actions/i }).click();
    await page.getByRole('option', { name: 'Created', exact: true }).click();

    // The trigger now shows the selected action and the list refetches.
    await expect(page.getByRole('combobox', { name: 'Created' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
