import type { Page } from '@playwright/test';
import { TEST_USER } from './fixtures';

/**
 * Log the test user in via the login page.
 *
 * This hits the real UI flow (fill form → submit) so the auth cookie is
 * set exactly as a real user would experience it.
 */
export async function login(
  page: Page,
  overrides?: { email?: string; password?: string },
) {
  const { email, password } = { ...TEST_USER, ...overrides };

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation away from login page
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Ensure the user is logged out by clearing cookies.
 */
export async function logout(page: Page) {
  await page.context().clearCookies();
}

/**
 * Navigate to the login page.
 */
export async function goToLogin(page: Page) {
  await page.goto('/login');
}
