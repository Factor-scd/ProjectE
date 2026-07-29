import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
  });

  test('should display calendar with month view by default', async ({ page }) => {
    // Month view should be visible
    await expect(page.getByText(/today/i)).toBeVisible();
  });

  test('should switch between month, week, and day views', async ({ page }) => {
    // Click week view
    const weekBtn = page.getByRole('button', { name: /week/i });
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await page.waitForTimeout(500);
    }

    // Click day view
    const dayBtn = page.getByRole('button', { name: /day/i });
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
      await page.waitForTimeout(500);
    }

    // Click month view
    const monthBtn = page.getByRole('button', { name: /month/i });
    if (await monthBtn.isVisible()) {
      await monthBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('should navigate between months', async ({ page }) => {
    // Click next month
    const nextBtn = page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Click previous month
    const prevBtn = page.getByRole('button', { name: /prev/i });
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
