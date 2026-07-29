import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should display dashboard with widgets', async ({ page }) => {
    // Dashboard should show at least one widget area
    await expect(page.locator('[class*="grid"]').first()).toBeVisible();
  });

  test('should show today tasks widget', async ({ page }) => {
    await expect(page.getByText(/today/i).first()).toBeVisible();
  });

  test('should show activity feed widget', async ({ page }) => {
    await expect(page.getByText(/activity/i).first()).toBeVisible();
  });
});
