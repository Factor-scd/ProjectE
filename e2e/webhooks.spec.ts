import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Webhooks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display webhooks page with create button', async ({ page }) => {
    await page.goto('/settings/webhooks');
    await page.waitForTimeout(1000);

    // The webhooks page should have a create button or heading
    const heading = page.getByRole('heading', { name: /webhook/i });
    const createBtn = page.getByRole('button', { name: /create|new webhook/i });

    // At least one should be visible
    await expect(
      heading.or(createBtn)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should list webhook deliveries endpoint', async ({ page }) => {
    const response = await page.request.get('/api/webhook-deliveries?limit=5');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('totalItems');
    expect(Array.isArray(body.items)).toBeTruthy();
  });
});
