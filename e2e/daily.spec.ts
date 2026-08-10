import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Daily Notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/daily');
    // Wait for the editor (mood/energy controls) to finish loading.
    await expect(page.getByRole('radiogroup', { name: 'Mood' })).toBeVisible();
  });

  test('renders the calendar sidebar and editor', async ({ page }) => {
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    await expect(page.getByText('Sun')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Energy' })).toBeVisible();
  });

  test('selecting a mood rating creates the daily note', async ({ page }) => {
    await page.getByRole('radio', { name: 'Mood 5' }).click();
    await expect(page.getByRole('radio', { name: 'Mood 5' })).toHaveAttribute('aria-checked', 'true');

    // Creating a mood on a day with no note materializes the editor.
    await expect(page.getByPlaceholder(/write your daily note/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('writes a daily note and it autosaves', async ({ page }) => {
    const textarea = page.getByPlaceholder(/write your daily note/i);

    if (!(await textarea.isVisible().catch(() => false))) {
      await page.getByRole('radio', { name: 'Mood 5' }).click();
      await expect(textarea).toBeVisible({ timeout: 10_000 });
    }

    await textarea.fill('E2E daily note content');

    // Once a note exists the header shows the "Saved" badge.
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
