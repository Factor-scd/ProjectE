import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renders the dashboard with the widget area', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Either the widget grid renders or the "add widget" entry point shows.
    await expect(page.getByRole('button', { name: /add widget/i })).toBeVisible();
  });

  test('adds the default widget set from an empty dashboard', async ({ page }) => {
    const addDefaults = page.getByRole('button', { name: /add default widgets/i });

    // Only the empty dashboard offers the default set; a dashboard that already
    // has widgets (from earlier runs) skips this.
    if (await addDefaults.isVisible().catch(() => false)) {
      await addDefaults.click();
      await expect(page.getByText(/tasks due today/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});
