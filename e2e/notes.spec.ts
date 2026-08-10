import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testNotes } from './helpers/fixtures';

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/notes');
    // The notes page has no h1; the "New Note" button marks it as loaded.
    await expect(page.getByRole('button', { name: /new note/i })).toBeVisible();
  });

  test('creates a note and opens it in the editor', async ({ page }) => {
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/notes') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /new note/i }).click();
    expect((await createResponse).ok()).toBeTruthy();

    // The new note is auto-selected and the TipTap editor becomes editable.
    await expect(page.locator('.note-editor [contenteditable="true"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('typing in the editor autosaves the content', async ({ page }) => {
    // Ensure a note is open first.
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/notes') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /new note/i }).click();
    await createResponse;

    const editor = page.locator('.note-editor [contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Typing triggers the debounced autosave PATCH.
    const patchResponse = page.waitForResponse(
      (resp) => /^\/api\/notes\/[^/?]+$/.test(new URL(resp.url()).pathname) &&
        resp.request().method() === 'PATCH',
    );
    await editor.fill(testNotes.content);
    expect((await patchResponse).ok()).toBeTruthy();
  });

  test('renames a note via the editor title input', async ({ page }) => {
    // Ensure a fresh note is open.
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/notes') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /new note/i }).click();
    await createResponse;

    // The new note is titled "Untitled"; rename it via the uncontrolled input.
    const titleInput = page.locator('input[value="Untitled"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    await titleInput.fill(testNotes.title);
    await titleInput.blur();

    // The updated title shows up in the note list.
    await expect(page.getByText(testNotes.title, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});
