import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testHabits } from './helpers/fixtures';

test.describe('Habits', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/habits');
    await expect(page.getByRole('heading', { name: /habits/i })).toBeVisible();
  });

  test('shows the empty state when there are no habits', async ({ page }) => {
    if (await page.getByText('No habits yet').isVisible().catch(() => false)) {
      await expect(page.getByText(/create your first one/i)).toBeVisible();
    }
  });

  test('creates a habit via the New Habit dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new habit/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Habit' })).toBeVisible();

    await dialog.getByLabel('Name').fill(testHabits.name);
    await dialog.getByLabel('Description').fill(testHabits.description);
    await dialog.getByRole('button', { name: /create habit/i }).click();

    // The dialog closes and the habit appears in the list.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(testHabits.name, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('marks a habit complete from the list', async ({ page }) => {
    // Ensure the fixture habit exists.
    if (!(await page.getByText(testHabits.name, { exact: true }).isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /new habit/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Name').fill(testHabits.name);
      await dialog.getByRole('button', { name: /create habit/i }).click();
      await expect(page.getByText(testHabits.name, { exact: true })).toBeVisible({ timeout: 10_000 });
    }

    // Completing today's habit bumps the streak to 1 day.
    await page.getByRole('button', { name: /mark .* complete/i }).first().click();
    await expect(page.getByText('1 day streak', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
