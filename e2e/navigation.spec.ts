import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Sidebar navigation', () => {
    test('should navigate to Dashboard via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /dashboard/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should navigate to Tasks via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /tasks/i }).click();
      await expect(page).toHaveURL(/\/tasks/);
      await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible();
    });

    test('should navigate to Habits via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /habits/i }).click();
      await expect(page).toHaveURL(/\/habits/);
      await expect(page.getByRole('heading', { name: /habits/i })).toBeVisible();
    });

    test('should navigate to Projects via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /projects/i }).click();
      await expect(page).toHaveURL(/\/projects/);
      await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    });

    test('should navigate to Notes via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /notes/i }).click();
      await expect(page).toHaveURL(/\/notes/);
      await expect(page.getByRole('heading', { name: /notes/i })).toBeVisible();
    });

    test('should navigate to Reports via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /reports/i }).click();
      await expect(page).toHaveURL(/\/reports/);
      await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
    });

    test('should navigate to Calendar via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /calendar/i }).click();
      await expect(page).toHaveURL(/\/calendar/);
      await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
    });

    test('should navigate to Analytics via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /analytics/i }).click();
      await expect(page).toHaveURL(/\/analytics/);
      await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    });

    test('should navigate to Settings via sidebar', async ({ page }) => {
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.goto('/tasks');
      const tasksLink = page.getByRole('link', { name: /tasks/i });
      await expect(tasksLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Sidebar collapse', () => {
    test('should toggle sidebar collapse', async ({ page }) => {
      const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
      await expect(collapseButton).toBeVisible();

      await collapseButton.click();

      // Sidebar should be collapsed - nav links should still be functional
      const expandButton = page.getByRole('button', { name: /expand sidebar/i });
      await expect(expandButton).toBeVisible();

      // Expand again
      await expandButton.click();
      await expect(collapseButton).toBeVisible();
    });
  });

  test.describe('Command palette', () => {
    test('should open command palette with Cmd+K', async ({ page }) => {
      await page.keyboard.press('Meta+k');
      await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({ timeout: 5_000 });
    });

    test('should open command palette via search button click', async ({ page }) => {
      await page.getByRole('button', { name: /open search/i }).click();
      await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({ timeout: 5_000 });
    });

    test('should navigate via command palette', async ({ page }) => {
      await page.keyboard.press('Meta+k');
      const dialog = page.getByRole('dialog', { name: /command palette/i });
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Type to filter commands
      await page.getByPlaceholder(/type a command/i).fill('tasks');
      await page.waitForTimeout(300);

      // Click on the Tasks navigation item
      await page.getByRole('option', { name: /tasks/i }).first().click();

      // Should navigate to tasks
      await expect(page).toHaveURL(/\/tasks/);
    });

    test('should close command palette with Escape', async ({ page }) => {
      await page.keyboard.press('Meta+k');
      await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({ timeout: 5_000 });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /command palette/i })).not.toBeVisible({ timeout: 3_000 });
    });
  });

  test.describe('Keyboard shortcuts', () => {
    test('should navigate to dashboard with G then D', async ({ page }) => {
      await page.goto('/tasks');
      await expect(page).toHaveURL(/\/tasks/);

      // Press G then D
      await page.keyboard.press('g');
      await page.keyboard.press('d');

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
    });

    test('should navigate to tasks with G then T', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);

      await page.keyboard.press('g');
      await page.keyboard.press('t');

      await expect(page).toHaveURL(/\/tasks/, { timeout: 5_000 });
    });

    test('should navigate to habits with G then H', async ({ page }) => {
      await page.goto('/dashboard');

      await page.keyboard.press('g');
      await page.keyboard.press('h');

      await expect(page).toHaveURL(/\/habits/, { timeout: 5_000 });
    });

    test('should navigate to projects with G then P', async ({ page }) => {
      await page.goto('/dashboard');

      await page.keyboard.press('g');
      await page.keyboard.press('p');

      await expect(page).toHaveURL(/\/projects/, { timeout: 5_000 });
    });

    test('should open search with / key', async ({ page }) => {
      await page.goto('/dashboard');

      // Press / to open search/command palette
      await page.keyboard.press('/');
      await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({ timeout: 5_000 });
    });
  });
});
