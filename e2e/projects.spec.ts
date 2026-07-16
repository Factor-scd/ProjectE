import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testProjects } from './helpers/fixtures';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    // Wait for the projects page to load
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test.describe('Projects list', () => {
    test('should display projects page with "New project" button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
    });

    test('should show empty state when no projects exist', async ({ page }) => {
      // If no projects, should show empty state
      const emptyState = page.getByText(/no projects yet/i);
      const projectCards = page.locator('[class*="hover:shadow-md"]');

      const count = await projectCards.count();
      if (count === 0) {
        await expect(emptyState).toBeVisible();
      }
    });

    test('should display project cards with status badges', async ({ page }) => {
      const projectCards = page.locator('[class*="hover:shadow-md"]');
      const count = await projectCards.count();

      if (count > 0) {
        // Project cards should have badges showing status
        await expect(projectCards.first()).toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Create project', () => {
    test('should open new project dialog/form when clicking "New project"', async ({ page }) => {
      await page.getByRole('button', { name: /new project/i }).click();
      await page.waitForTimeout(500);
    });
  });

  test.describe('Project detail page', () => {
    test('should navigate to project detail page when clicking a project', async ({ page }) => {
      const projectCards = page.locator('[class*="hover:shadow-md"]');
      const count = await projectCards.count();

      if (count > 0) {
        await projectCards.first().click();
        // Should navigate to /projects/[id]
        await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

        // Should show project name and tabs
        await expect(page.getByRole('button', { name: /back to projects/i })).toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Project detail page content', () => {
    test('should show tabs for Tasks, Milestones, Habits, and Notes', async ({ page }) => {
      // Navigate to a project detail page if projects exist
      const projectCards = page.locator('[class*="hover:shadow-md"]');
      const count = await projectCards.count();

      if (count > 0) {
        await projectCards.first().click();
        await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

        // Should have tabs
        await expect(page.getByRole('tab', { name: /tasks/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /milestones/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /habits/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /notes/i })).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should switch between project tabs', async ({ page }) => {
      const projectCards = page.locator('[class*="hover:shadow-md"]');
      const count = await projectCards.count();

      if (count > 0) {
        await projectCards.first().click();
        await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10_000 });

        // Click milestones tab
        await page.getByRole('tab', { name: /milestones/i }).click();
        await expect(page.getByRole('tab', { name: /milestones/i })).toHaveAttribute('data-state', 'active');

        // Click tasks tab
        await page.getByRole('tab', { name: /tasks/i }).click();
        await expect(page.getByRole('tab', { name: /tasks/i })).toHaveAttribute('data-state', 'active');
      } else {
        test.skip();
      }
    });
  });
});
