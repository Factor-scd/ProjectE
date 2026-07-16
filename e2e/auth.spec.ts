import { test, expect } from '@playwright/test';
import { login, logout, goToLogin } from './helpers/auth';
import { TEST_USER, INVALID_USER } from './helpers/fixtures';

test.describe('Authentication Flow', () => {
  test.describe('Login', () => {
    test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
      await goToLogin(page);

      // Verify login page loaded
      await expect(page.getByRole('heading', { name: /project e/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

      // Fill in credentials
      await page.getByLabel('Email').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 15_000 });
      await expect(page).toHaveURL(/\/dashboard/);

      // Dashboard should be visible
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await goToLogin(page);

      await page.getByLabel('Email').fill(INVALID_USER.email);
      await page.getByLabel('Password').fill(INVALID_USER.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/);

      // Should show error message (toast or inline)
      // The app uses sonner toasts for errors
      await expect(
        page.getByText(/login failed|invalid/i),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('should prevent submitting empty form', async ({ page }) => {
      await goToLogin(page);

      const submitButton = page.getByRole('button', { name: /sign in/i });
      await expect(submitButton).toBeVisible();

      // HTML5 required attribute should prevent submission
      // The email field is required
      await page.getByLabel('Password').fill('somepassword');
      await submitButton.click();

      // Should stay on login page (HTML5 validation prevents submit)
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Logout', () => {
    test('should logout and redirect to login page', async ({ page }) => {
      // First login
      await login(page);
      await expect(page).toHaveURL(/\/dashboard/);

      // Clear cookies to simulate logout
      await logout(page);

      // Navigate to dashboard – should redirect to login
      await page.goto('/dashboard');
      await page.waitForURL('**/login', { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Session persistence', () => {
    test('should stay logged in after page refresh', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL(/\/dashboard/);

      // Refresh the page
      await page.reload();

      // Should still be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });
  });

  test.describe('Protected routes', () => {
    test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
      await logout(page);
      await page.goto('/dashboard');
      await page.waitForURL('**/login', { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect unauthenticated users from tasks to login', async ({ page }) => {
      await logout(page);
      await page.goto('/tasks');
      await page.waitForURL('**/login', { timeout: 10_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
