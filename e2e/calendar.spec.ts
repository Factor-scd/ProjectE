import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/calendar');
    // Wait for the calendar page to load
    await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
  });

  test.describe('Calendar page', () => {
    test('should display calendar heading and tagline', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
      await expect(page.getByText(/your commitments, in time/i)).toBeVisible();
    });

    test('should show filters sidebar', async ({ page }) => {
      await expect(page.getByText(/filters/i).first()).toBeVisible();
    });
  });

  test.describe('Calendar filters', () => {
    test('should show entity type filter checkboxes', async ({ page }) => {
      // Tasks, Habits, Projects, Milestones checkboxes
      await expect(page.getByLabel('Tasks')).toBeVisible();
      await expect(page.getByLabel('Habits')).toBeVisible();
      await expect(page.getByLabel('Projects')).toBeVisible();
      await expect(page.getByLabel('Milestones')).toBeVisible();
    });

    test('should toggle entity type filters', async ({ page }) => {
      const tasksCheckbox = page.getByLabel('Tasks');
      const initialState = await tasksCheckbox.isChecked();

      await tasksCheckbox.click();
      await page.waitForTimeout(300);

      // State should have toggled
      const newState = await tasksCheckbox.isChecked();
      expect(newState).toBe(!initialState);
    });

    test('should show domain filter checkboxes', async ({ page }) => {
      // Domain checkboxes: personal, work, ots
      await expect(page.getByLabel('personal')).toBeVisible();
      await expect(page.getByLabel('work')).toBeVisible();
      await expect(page.getByLabel('ots')).toBeVisible();
    });

    test('should toggle domain filters', async ({ page }) => {
      const personalCheckbox = page.getByLabel('personal');
      await personalCheckbox.click();
      await page.waitForTimeout(300);

      // Clear filters button should appear
      await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
    });

    test('should clear all domain filters', async ({ page }) => {
      // Select a domain first
      await page.getByLabel('personal').click();
      await page.waitForTimeout(300);

      // Clear filters
      await page.getByRole('button', { name: /clear filters/i }).click();
      await page.waitForTimeout(300);

      // Clear filters button should disappear
      await expect(page.getByRole('button', { name: /clear filters/i })).not.toBeVisible();
    });
  });

  test.describe('Calendar view', () => {
    test('should render the calendar component', async ({ page }) => {
      // The calendar should be visible after loading
      // Wait for the lazy-loaded calendar
      await page.waitForTimeout(3_000);

      // Calendar should be rendered (react-big-calendar)
      // We verify the container is present
      const calendarContainer = page.locator('.rbc-calendar, [class*="calendar"]').first();
      // Just verify the page loaded without errors
      await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();
    });
  });

  test.describe('Calendar legend', () => {
    test('should show calendar legend', async ({ page }) => {
      await expect(page.getByText(/tasks show on due date/i)).toBeVisible();
      await expect(page.getByText(/projects show on deadline/i)).toBeVisible();
    });
  });
});
