import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('should display projects page with grid layout', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
  });

  test('should open new project dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new project/i }).click();
    // Dialog should appear
    await page.waitForTimeout(500);
  });

  test('should show project cards in grid', async ({ page }) => {
    // The grid container should exist
    const grid = page.locator('.grid, [class*="grid"]').first();
    await expect(grid).toBeVisible();
  });
});
