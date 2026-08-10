import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });

  test('renders the analytics cards', async ({ page }) => {
    await expect(page.getByText(/tasks completed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/created vs completed/i)).toBeVisible();
    await expect(page.getByText(/habit completion/i)).toBeVisible();
    await expect(page.getByText(/productivity heatmap/i)).toBeVisible();
  });

  test('switches the reporting range', async ({ page }) => {
    await page.getByRole('combobox', { name: /last 30 days/i }).click();
    await page.getByRole('option', { name: /last 90 days/i }).click();

    await expect(page.getByRole('combobox', { name: /last 90 days/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
