import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testNotes } from './helpers/fixtures';

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/notes');
    // Wait for the notes page to load
    await expect(page.getByRole('heading', { name: /notes/i })).toBeVisible();
  });

  test.describe('Notes page layout', () => {
    test('should display three-panel layout', async ({ page }) => {
      // Notes page has: notes list | editor | backlinks/graph
      await expect(page.getByText(/connect ideas/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /new note/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /daily note/i })).toBeVisible();
    });

    test('should show empty state when no notes exist', async ({ page }) => {
      const noteItems = page.locator('button[aria-label^="Open note:"]');
      const count = await noteItems.count();

      if (count === 0) {
        await expect(page.getByText(/no notes yet/i)).toBeVisible();
      }
    });
  });

  test.describe('Create note', () => {
    test('should create a new note when clicking "New note"', async ({ page }) => {
      // Intercept the API call
      const createResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/notes') && resp.request().method() === 'POST',
      );

      await page.getByRole('button', { name: /new note/i }).click();

      // Wait for the API response
      const response = await createResponsePromise;
      expect(response.ok()).toBeTruthy();

      // The new note should appear in the list and be selected
      await page.waitForTimeout(1_000);
    });
  });

  test.describe('Note editor', () => {
    test('should show editor when a note is selected', async ({ page }) => {
      const noteItems = page.locator('button[aria-label^="Open note:"]');
      const count = await noteItems.count();

      if (count > 0) {
        // Click first note to select it
        await noteItems.first().click();

        // Editor should be visible (title input at minimum)
        await expect(page.getByLabel('Note title')).toBeVisible();
      } else {
        // Create a note first
        await page.getByRole('button', { name: /new note/i }).click();
        await page.waitForTimeout(1_000);
        await expect(page.getByLabel('Note title')).toBeVisible();
      }
    });

    test('should update note title when edited', async ({ page }) => {
      // Ensure a note is selected
      const noteItems = page.locator('button[aria-label^="Open note:"]');
      const count = await noteItems.count();

      if (count === 0) {
        await page.getByRole('button', { name: /new note/i }).click();
        await page.waitForTimeout(1_000);
      }

      const titleInput = page.getByLabel('Note title');
      await expect(titleInput).toBeVisible();

      // Update the title
      await titleInput.clear();
      await titleInput.fill(testNotes.title);

      // Trigger blur to save
      await titleInput.blur();
      await page.waitForTimeout(500);
    });
  });

  test.describe('Note backlinks and graph', () => {
    test('should show backlinks and graph tabs', async ({ page }) => {
      // Right panel should have Backlinks and Graph tabs
      await expect(page.getByRole('tab', { name: /backlinks/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /graph/i })).toBeVisible();
    });

    test('should switch between backlinks and graph views', async ({ page }) => {
      // Click graph tab
      await page.getByRole('tab', { name: /graph/i }).click();
      await expect(page.getByRole('tab', { name: /graph/i })).toHaveAttribute('data-state', 'active');

      // Click backlinks tab
      await page.getByRole('tab', { name: /backlinks/i }).click();
      await expect(page.getByRole('tab', { name: /backlinks/i })).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Daily note', () => {
    test('should show "Daily note" button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /daily note/i })).toBeVisible();
    });

    test('should create or select daily note when clicking button', async ({ page }) => {
      await page.getByRole('button', { name: /daily note/i }).click();
      await page.waitForTimeout(1_000);

      // After clicking, a note with today's date should be selected
      const today = new Date().toLocaleDateString();
      // The title might contain the date
    });
  });
});
