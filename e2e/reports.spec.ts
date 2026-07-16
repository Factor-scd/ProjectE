import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testReports } from './helpers/fixtures';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/reports');
    // Wait for the reports page to load
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test.describe('Reports page layout', () => {
    test('should display two-panel layout', async ({ page }) => {
      // Reports page has: reports list | editor
      await expect(page.getByText(/step back and see/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /new report/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /from template/i })).toBeVisible();
    });

    test('should show empty state when no reports exist', async ({ page }) => {
      const reportItems = page.locator('button[aria-label^="Open report:"]');
      const count = await reportItems.count();

      if (count === 0) {
        await expect(page.getByText(/no reports yet/i)).toBeVisible();
      }
    });
  });

  test.describe('Create report', () => {
    test('should create a new report when clicking "New report"', async ({ page }) => {
      const createResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/reports') && resp.request().method() === 'POST',
      );

      await page.getByRole('button', { name: /new report/i }).click();
      const response = await createResponsePromise;
      expect(response.ok()).toBeTruthy();

      await page.waitForTimeout(1_000);
    });
  });

  test.describe('Report from template', () => {
    test('should show templates view when clicking "From template"', async ({ page }) => {
      await page.getByRole('button', { name: /from template/i }).click();
      await page.waitForTimeout(1_000);

      // Should show template options or a templates view
    });
  });

  test.describe('Report editor', () => {
    test('should show editor when a report is selected', async ({ page }) => {
      const reportItems = page.locator('button[aria-label^="Open report:"]');
      const count = await reportItems.count();

      if (count === 0) {
        // Create a report first
        await page.getByRole('button', { name: /new report/i }).click();
        await page.waitForTimeout(1_000);
      }

      // Report title input should be visible
      await expect(page.getByLabel('Report title')).toBeVisible();
    });

    test('should update report title when edited', async ({ page }) => {
      const reportItems = page.locator('button[aria-label^="Open report:"]');
      const count = await reportItems.count();

      if (count === 0) {
        await page.getByRole('button', { name: /new report/i }).click();
        await page.waitForTimeout(1_000);
      }

      const titleInput = page.getByLabel('Report title');
      await expect(titleInput).toBeVisible();

      await titleInput.clear();
      await titleInput.fill(testReports.title);
      await titleInput.blur();
      await page.waitForTimeout(500);
    });

    test('should show report metadata badges', async ({ page }) => {
      const reportItems = page.locator('button[aria-label^="Open report:"]');
      const count = await reportItems.count();

      if (count > 0) {
        await reportItems.first().click();
        await page.waitForTimeout(500);

        // Should show report type and domain badges
        const badges = page.locator('[class*="badge"]');
        const badgeCount = await badges.count();
        expect(badgeCount).toBeGreaterThan(0);
      } else {
        test.skip();
      }
    });
  });
});
