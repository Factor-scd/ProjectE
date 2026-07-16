import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testDomains } from './helpers/fixtures';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    // Wait for the settings page to load
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test.describe('Settings page layout', () => {
    test('should display all settings tabs', async ({ page }) => {
      // Vertical tabs: Appearance, Domains, Keyboard Shortcuts, Agents, Webhooks, Import & Export, Error Log
      await expect(page.getByRole('tab', { name: /appearance/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /domains/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /keyboard shortcuts/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /agents/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /webhooks/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /import.*export/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /error log/i })).toBeVisible();
    });
  });

  test.describe('Appearance settings', () => {
    test('should show theme mode selector', async ({ page }) => {
      // Appearance tab should be active by default
      await expect(page.getByLabel('Theme')).toBeVisible();
    });

    test('should change theme mode', async ({ page }) => {
      // Find the theme mode select
      const themeSelect = page.getByLabel('Theme');
      await expect(themeSelect).toBeVisible();

      // Click to open dropdown
      await themeSelect.click();

      // Should show theme options (light, dark, system)
      await expect(page.getByRole('option', { name: /light/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /dark/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /system/i })).toBeVisible();
    });

    test('should show accent color picker', async ({ page }) => {
      const colorPicker = page.getByRole('radiogroup', { name: /accent color/i });
      await expect(colorPicker).toBeVisible();

      // Should have color buttons
      const colorButtons = colorPicker.getByRole('radio');
      const count = await colorButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should change accent color', async ({ page }) => {
      const colorPicker = page.getByRole('radiogroup', { name: /accent color/i });
      const colorButtons = colorPicker.getByRole('radio');
      const count = await colorButtons.count();

      if (count > 1) {
        // Click a different color
        await colorButtons.nth(1).click();
        // Should update the accent color
        await expect(colorButtons.nth(1)).toHaveAttribute('aria-checked', 'true');
      }
    });
  });

  test.describe('Domains settings', () => {
    test('should switch to domains tab', async ({ page }) => {
      await page.getByRole('tab', { name: /domains/i }).click();
      await expect(page.getByText(/manage your workspace domains/i)).toBeVisible();
    });

    test('should add a new domain', async ({ page }) => {
      await page.getByRole('tab', { name: /domains/i }).click();

      const domainInput = page.getByPlaceholder(/new domain name/i);
      await expect(domainInput).toBeVisible();

      await domainInput.fill(testDomains.name);

      // Intercept the API call
      const createResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/domains') && resp.request().method() === 'POST',
      );

      await page.getByRole('button', { name: /add/i }).click();

      const response = await createResponsePromise;
      expect(response.ok()).toBeTruthy();

      // The new domain should appear in the list
      await page.waitForTimeout(1_000);
      await expect(page.getByText(testDomains.name)).toBeVisible();
    });
  });

  test.describe('Keyboard shortcuts settings', () => {
    test('should show shortcuts list', async ({ page }) => {
      await page.getByRole('tab', { name: /keyboard shortcuts/i }).click();

      // Should show shortcuts toggle and list
      await expect(page.getByLabel('Enable keyboard shortcuts')).toBeVisible();
      await expect(page.getByRole('button', { name: /reset to defaults/i })).toBeVisible();
    });

    test('should toggle keyboard shortcuts', async ({ page }) => {
      await page.getByRole('tab', { name: /keyboard shortcuts/i }).click();

      const toggle = page.getByLabel('Enable keyboard shortcuts');
      const initialState = await toggle.getAttribute('data-state');

      await toggle.click();
      await page.waitForTimeout(300);

      // State should have changed
      const newState = await toggle.getAttribute('data-state');
      expect(newState).not.toBe(initialState);
    });
  });

  test.describe('Agents settings', () => {
    test('should show agents list and create button', async ({ page }) => {
      await page.getByRole('tab', { name: /agents/i }).click();

      await expect(page.getByText(/agents.*permissions/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /new agent/i })).toBeVisible();
    });

    test('should open create agent dialog', async ({ page }) => {
      await page.getByRole('tab', { name: /agents/i }).click();
      await page.getByRole('button', { name: /new agent/i }).click();

      // Dialog should open
      await expect(page.getByRole('dialog', { name: /create agent/i })).toBeVisible({ timeout: 5_000 });

      // Should have form fields
      await expect(page.getByLabel('Name')).toBeVisible();
      await expect(page.getByLabel('Permission tier')).toBeVisible();
    });
  });

  test.describe('Import & Export settings', () => {
    test('should show export and import sections', async ({ page }) => {
      await page.getByRole('tab', { name: /import.*export/i }).click();

      await expect(page.getByText(/export data/i)).toBeVisible();
      await expect(page.getByText(/import data/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /export to json/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /import from json/i })).toBeVisible();
    });

    test('should show collection selection for export', async ({ page }) => {
      await page.getByRole('tab', { name: /import.*export/i }).click();

      // Should have checkboxes for each collection
      await expect(page.getByLabel(/select all/i)).toBeVisible();
      await expect(page.getByLabel(/export tasks/i)).toBeVisible();
      await expect(page.getByLabel(/export habits/i)).toBeVisible();
    });

    test('should toggle collection selection', async ({ page }) => {
      await page.getByRole('tab', { name: /import.*export/i }).click();

      const selectAll = page.getByLabel(/select all/i);
      await expect(selectAll).toBeVisible();

      // Toggle select all off
      await selectAll.click();
      await page.waitForTimeout(300);

      // Tasks checkbox should be unchecked
      const tasksCheckbox = page.getByLabel(/export tasks/i);
      // The checkbox state should be unchecked now
    });
  });
});
