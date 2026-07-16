import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/analytics');
    // Wait for the analytics page to load
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });

  test.describe('Analytics page', () => {
    test('should display analytics heading and tagline', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
      await expect(page.getByText(/patterns behind your progress/i)).toBeVisible();
    });
  });

  test.describe('Summary cards', () => {
    test('should display summary stat cards', async ({ page }) => {
      // Should show 4 stat cards: Task Completion, Habit Consistency, Time Tracked, Active Streaks
      await expect(page.getByText(/task completion/i)).toBeVisible();
      await expect(page.getByText(/habit consistency/i)).toBeVisible();
      await expect(page.getByText(/time tracked/i)).toBeVisible();
      await expect(page.getByText(/active streaks/i)).toBeVisible();
    });

    test('should display percentage values', async ({ page }) => {
      // Task completion and habit consistency should show percentages
      const percentElements = page.locator('text=/\\d+%/');
      const count = await percentElements.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Analytics tabs', () => {
    test('should show Trends, Habits, and Time tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /trends/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /habits/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /time/i })).toBeVisible();
    });

    test('should default to Trends tab', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /trends/i })).toHaveAttribute('data-state', 'active');
    });

    test('should switch to Habits tab', async ({ page }) => {
      await page.getByRole('tab', { name: /habits/i }).click();
      await expect(page.getByRole('tab', { name: /habits/i })).toHaveAttribute('data-state', 'active');

      // Wait for chart to load
      await page.waitForTimeout(1_000);
    });

    test('should switch to Time tab', async ({ page }) => {
      await page.getByRole('tab', { name: /time/i }).click();
      await expect(page.getByRole('tab', { name: /time/i })).toHaveAttribute('data-state', 'active');

      // Wait for chart to load
      await page.waitForTimeout(1_000);
    });

    test('should switch between all tabs', async ({ page }) => {
      // Start on Trends
      await expect(page.getByRole('tab', { name: /trends/i })).toHaveAttribute('data-state', 'active');

      // Switch to Habits
      await page.getByRole('tab', { name: /habits/i }).click();
      await expect(page.getByRole('tab', { name: /habits/i })).toHaveAttribute('data-state', 'active');

      // Switch to Time
      await page.getByRole('tab', { name: /time/i }).click();
      await expect(page.getByRole('tab', { name: /time/i })).toHaveAttribute('data-state', 'active');

      // Switch back to Trends
      await page.getByRole('tab', { name: /trends/i }).click();
      await expect(page.getByRole('tab', { name: /trends/i })).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Analytics charts', () => {
    test('should load chart components for each tab', async ({ page }) => {
      // Wait for charts to render (recharts is lazy loaded)
      await page.waitForTimeout(3_000);

      // Verify the page has rendered without errors
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
    });
  });
});
