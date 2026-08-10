import type { Page } from '@playwright/test';
import { TEST_USER } from './fixtures';

/**
 * Log the test user in via the login page.
 *
 * This exercises the real UI flow (fill form → submit) so the `session` cookie
 * is set exactly as a real user would experience it. Successful logins navigate
 * to the "/" dashboard.
 *
 * The very first login on an empty database auto-creates the admin user; when
 * several parallel workers race that first login one of them can hit a
 * transient server error, so the submit is retried once.
 */
export async function login(
  page: Page,
  overrides?: { email?: string; password?: string },
) {
  const { email, password } = { ...TEST_USER, ...overrides };

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      // Wait for navigation away from the login page to the "/" dashboard.
      await page.waitForURL('**/', { timeout: 10_000 });
      return;
    } catch (error) {
      lastError = error;
      // A transient failure leaves the form on the login page — refill and retry.
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Login failed');
}

/**
 * Log the user out by hitting the logout endpoint, then land on the login page.
 */
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout');
  await page.goto('/login');
}

/**
 * Navigate to the login page.
 */
export async function goToLogin(page: Page) {
  await page.goto('/login');
}
