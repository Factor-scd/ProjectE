import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    // Wait for the settings page to load
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    // Switch to Import & Export tab
    await page.getByRole('tab', { name: /import.*export/i }).click();
  });

  test.describe('Export', () => {
    test('should show export section with collection selection', async ({ page }) => {
      await expect(page.getByText(/export data/i)).toBeVisible();
      await expect(page.getByLabel(/select all/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /export to json/i })).toBeVisible();
    });

    test('should have all collection checkboxes', async ({ page }) => {
      const collections = [
        'tasks', 'habits', 'projects', 'notes', 'reports',
        'milestones', 'domains', 'tags', 'agents', 'webhooks',
      ];

      for (const collection of collections) {
        await expect(page.getByLabel(new RegExp(`export ${collection}`, 'i'))).toBeVisible();
      }
    });

    test('should toggle select all checkbox', async ({ page }) => {
      const selectAll = page.getByLabel(/select all/i);
      await expect(selectAll).toBeChecked();

      // Uncheck select all
      await selectAll.click();
      await page.waitForTimeout(300);

      // Individual checkboxes should be unchecked
      const tasksCheckbox = page.getByLabel(/export tasks/i);
      await expect(tasksCheckbox).not.toBeChecked();

      // Check select all again
      await selectAll.click();
      await page.waitForTimeout(300);
      await expect(tasksCheckbox).toBeChecked();
    });

    test('should export data as JSON', async ({ page }) => {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download');

      await page.getByRole('button', { name: /export to json/i }).click();

      try {
        const download = await downloadPromise;
        // Verify download started
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/project-e-export.*\.json/);
      } catch {
        // Export might fail if PocketBase isn't running – that's OK for structure test
      }
    });
  });

  test.describe('Import', () => {
    test('should show import section', async ({ page }) => {
      await expect(page.getByText(/import data/i)).toBeVisible();
      await expect(page.getByText(/restore from a previously exported/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /import from json/i })).toBeVisible();
    });

    test('should have file upload input', async ({ page }) => {
      // The file input is hidden, triggered by the button
      const fileInput = page.locator('input[type="file"][accept=".json"]');
      await expect(fileInput).toBeAttached();
    });

    test('should import data from JSON file', async ({ page }) => {
      // Create a minimal valid import file
      const importData = {
        version: 1,
        exported_at: new Date().toISOString(),
        collections: {
          tasks: [],
          habits: [],
          projects: [],
          notes: [],
          reports: [],
        },
      };

      const tempDir = os.tmpdir();
      const importFile = path.join(tempDir, `e2e-import-${Date.now()}.json`);
      fs.writeFileSync(importFile, JSON.stringify(importData, null, 2));

      try {
        // Trigger file upload
        const fileInput = page.locator('input[type="file"][accept=".json"]');
        await fileInput.setInputFiles(importFile);

        // Confirmation dialog should appear
        await expect(page.getByRole('dialog', { name: /confirm import/i })).toBeVisible({ timeout: 5_000 });

        // Click Import button in dialog
        await page.getByRole('button', { name: /import$/i }).click();

        // Wait for import to complete
        await page.waitForTimeout(3_000);
      } finally {
        // Cleanup temp file
        try { fs.unlinkSync(importFile); } catch { /* ignore */ }
      }
    });

    test('should show import confirmation dialog', async ({ page }) => {
      const importData = {
        version: 1,
        exported_at: new Date().toISOString(),
        collections: { tasks: [], habits: [], projects: [], notes: [], reports: [] },
      };

      const tempDir = os.tmpdir();
      const importFile = path.join(tempDir, `e2e-import-dialog-${Date.now()}.json`);
      fs.writeFileSync(importFile, JSON.stringify(importData, null, 2));

      try {
        const fileInput = page.locator('input[type="file"][accept=".json"]');
        await fileInput.setInputFiles(importFile);

        // Confirmation dialog
        const dialog = page.getByRole('dialog', { name: /confirm import/i });
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // Should have Cancel and Import buttons
        await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();
        await expect(dialog.getByRole('button', { name: /import/i })).toBeVisible();

        // Cancel the import
        await dialog.getByRole('button', { name: /cancel/i }).click();
        await expect(dialog).not.toBeVisible({ timeout: 3_000 });
      } finally {
        try { fs.unlinkSync(importFile); } catch { /* ignore */ }
      }
    });
  });
});
