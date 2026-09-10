import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testTasks } from './helpers/fixtures';

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible();
  });

  test('shows the kanban board with the four status columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();
  });

  test('creates a task via the New Task dialog and shows it on the board', async ({ page }) => {
    await page.getByRole('button', { name: /new task/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Task' })).toBeVisible();

    await dialog.getByLabel('Title').fill(testTasks.title);
    await dialog.getByLabel('Description').fill(testTasks.description);
    await dialog.getByRole('button', { name: /create task/i }).click();

    // The dialog closes and the task appears in the Todo column.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(testTasks.title, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('opens the task detail panel when a task card is clicked', async ({ page }) => {
    // Make sure a task exists before trying to open it.
    if (!(await page.getByText(testTasks.title, { exact: true }).isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /new task/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title').fill(testTasks.title);
      await dialog.getByRole('button', { name: /create task/i }).click();
      await expect(page.getByText(testTasks.title, { exact: true })).toBeVisible({ timeout: 10_000 });
    }

    await page.getByText(testTasks.title, { exact: true }).first().click();

    // Clicking a card opens the slide-over detail panel.
    await expect(page.getByText('Task details')).toBeVisible({ timeout: 10_000 });

    // The panel offers a link to the full detail page.
    await page.getByRole('button', { name: /open full page/i }).click();
    await page.waitForURL('**/tasks/*', { timeout: 10_000 });

    // The detail page renders the task title as a heading.
    await expect(
      page.getByRole('heading', { name: testTasks.title, level: 3 }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('switches between board, list, and calendar views', async ({ page }) => {
    await page.getByRole('tab', { name: /list view/i }).click();
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();

    await page.getByRole('tab', { name: /calendar view/i }).click();
    await expect(page.getByText(/today/i).first()).toBeVisible();

    await page.getByRole('tab', { name: /board view/i }).click();
    await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
  });
});
