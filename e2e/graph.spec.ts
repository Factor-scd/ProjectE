import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Graph', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/graph');
  });

  test('renders the graph toolbar with search and zoom controls', async ({ page }) => {
    await expect(page.getByPlaceholder(/find a node/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /zoom out/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reset view/i })).toBeVisible();
  });

  test('opens the filters panel with entity type toggles', async ({ page }) => {
    await page.getByRole('button', { name: /filters/i }).click();

    await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Tasks' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Habits' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Projects' })).toBeVisible();
  });
});
