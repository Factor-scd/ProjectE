import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testCanvas } from './helpers/fixtures';

test.describe('Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/canvas');
    await expect(page.getByRole('heading', { name: /canvas/i })).toBeVisible();
  });

  test('renders the canvas list', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new canvas/i })).toBeVisible();
  });

  test('creates a canvas and opens the editor', async ({ page }) => {
    await page.getByRole('button', { name: /new canvas/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Canvas' })).toBeVisible();

    await dialog.getByLabel('Name').fill(testCanvas.name);

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/canvas') && resp.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /^create$/i }).click();
    expect((await createResponse).ok()).toBeTruthy();

    // Creating a canvas navigates straight into the editor at /canvas/<id>.
    await page.waitForURL('**/canvas/*', { timeout: 10_000 });
    await expect(page.getByPlaceholder(/type \/ for commands/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
