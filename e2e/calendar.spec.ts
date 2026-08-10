import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { testCalendarEvents } from './helpers/fixtures';

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
  });

  /** Fill the New Event dialog and submit it, returning the POST response. */
  async function createEvent(page: import('@playwright/test').Page, title: string) {
    await page.getByRole('button', { name: /new event/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'New Event' })).toBeVisible();

    await dialog.getByLabel('Title').fill(title);

    // The API requires an ISO start time; schedule the event for today so it
    // lands in the current month view.
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    await dialog.getByLabel('Start').fill(toLocal(start));
    await dialog.getByLabel('End').fill(toLocal(end));

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/calendar/events') && resp.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /create event/i }).click();
    await createResponse;
    await expect(dialog).toBeHidden();
  }

  test('renders the calendar page', async ({ page }) => {
    // react-big-calendar only mounts once events exist; otherwise a friendly
    // empty state is shown. Accept either so a fresh DB still passes.
    await expect(
      page.getByText(/no events yet/i).or(page.locator('.rbc-calendar-container')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('creates an event via the New Event dialog', async ({ page }) => {
    await createEvent(page, testCalendarEvents.title);

    // The calendar now renders and the event shows up on it.
    await expect(page.locator('.rbc-calendar-container')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('.rbc-event').filter({ hasText: testCalendarEvents.title }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('switches between month, week, and day views', async ({ page }) => {
    // The toolbar only exists when the calendar is rendered, so make sure at
    // least one event exists first.
    if (!(await page.locator('.rbc-calendar-container').isVisible().catch(() => false))) {
      await createEvent(page, `${testCalendarEvents.title} view`);
    }

    await expect(page.locator('.rbc-calendar-container')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page.locator('.rbc-calendar-container')).toBeVisible();

    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(page.locator('.rbc-calendar-container')).toBeVisible();

    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page.locator('.rbc-calendar-container')).toBeVisible();
  });
});
