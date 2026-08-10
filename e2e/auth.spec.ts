import { test, expect } from '@playwright/test';
import { login, logout, goToLogin } from './helpers/auth';
import { TEST_USER, INVALID_USER } from './helpers/fixtures';

test.describe('Authentication Flow', () => {
  test('logs in with valid credentials and redirects to the dashboard', async ({ page }) => {
    await goToLogin(page);

    // The login page renders a Card titled "Sign in".
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Successful login navigates to the "/" dashboard.
    await page.waitForURL('**/', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await goToLogin(page);

    await page.getByLabel('Email').fill(INVALID_USER.email);
    await page.getByLabel('Password').fill(INVALID_USER.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Stay on the login page and surface the API error in a role="alert" box.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toContainText('Invalid email or password', {
      timeout: 10_000,
    });
  });

  test('logs out from the user menu and returns to the login page', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // The topbar avatar dropdown works on every viewport (the sidebar user menu
    // is desktop-only), so use it for the logout flow.
    const avatarButton = page.getByRole('banner').getByRole('button').last();
    await avatarButton.click();
    await page.getByRole('menuitem', { name: /log out/i }).click();

    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('keeps the session after a page reload', async ({ page }) => {
    await login(page);

    await page.reload();

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('redirects unauthenticated users from protected pages to login', async ({ page }) => {
    await logout(page);

    await page.goto('/tasks');
    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
