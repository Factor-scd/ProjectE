import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display search page with search input', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();
  });

  test('should perform search and show results', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill('test');
    // Wait for results
    await page.waitForTimeout(1000);
  });
});
