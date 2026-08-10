import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testProjects } from './helpers/fixtures';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('creates a project via the New Project dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new project/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Project' })).toBeVisible();

    await dialog.getByLabel('Name').fill(testProjects.name);
    await dialog.getByLabel('Description').fill(testProjects.description);
    await dialog.getByRole('button', { name: /create project/i }).click();

    // The dialog closes and the project card appears in the grid.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(testProjects.name, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('opens the project detail page from a project card', async ({ page }) => {
    // Ensure the fixture project exists.
    if (!(await page.getByText(testProjects.name, { exact: true }).isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /new project/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Name').fill(testProjects.name);
      await dialog.getByRole('button', { name: /create project/i }).click();
      await expect(page.getByText(testProjects.name, { exact: true })).toBeVisible({ timeout: 10_000 });
    }

    await page.getByText(testProjects.name, { exact: true }).first().click();

    await page.waitForURL('**/projects/*', { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: testProjects.name, level: 3 }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
