import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testDomains } from './helpers/fixtures';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
  });

  test('renders every settings tab', async ({ page }) => {
    const tabs = [
      'Appearance',
      'Domains',
      'Tags',
      'Custom Fields',
      'Keyboard Shortcuts',
      'Agents & Permissions',
      'Webhooks',
      'Import & Export',
      'Error Log',
    ];
    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('opens on the Appearance tab with theme controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accent Color' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Font Size' })).toBeVisible();
  });

  test('creates a domain from the Domains tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Domains' }).click();
    await page.getByRole('button', { name: /new domain/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Domain' })).toBeVisible();

    await dialog.getByLabel('Name').fill(testDomains.name);

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/domains') && resp.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /^create$/i }).click();
    expect((await createResponse).ok()).toBeTruthy();

    await expect(page.getByText(testDomains.name, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Webhooks tab opens the New Webhook dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Webhooks' }).click();
    await expect(page.getByRole('button', { name: /new webhook/i })).toBeVisible();

    await page.getByRole('button', { name: /new webhook/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeVisible();
    await expect(dialog.getByLabel('URL')).toBeVisible();
    await expect(dialog.getByLabel(/events/i)).toBeVisible();
  });

  test('Import & Export tab renders import and export sections', async ({ page }) => {
    await page.getByRole('button', { name: 'Import & Export' }).click();

    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: /download export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^import$/i })).toBeVisible();
  });

  test('Error Log tab renders its controls', async ({ page }) => {
    await page.getByRole('button', { name: 'Error Log' }).click();

    await expect(page.getByRole('button', { name: /clear all/i })).toBeVisible();
  });
});
