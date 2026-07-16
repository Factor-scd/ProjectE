import type { Page } from '@playwright/test';

/** Test user credentials – matches PocketBase seed data or test fixtures. */
export const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
};

/** Fake credentials that should always fail login. */
export const INVALID_USER = {
  email: 'nonexistent@example.com',
  password: 'wrongpassword',
};

/** Unique timestamp suffix to avoid collisions in concurrent test runs. */
const ts = Date.now();

export const testTasks = {
  title: `E2E Test Task ${ts}`,
  editedTitle: `E2E Test Task Edited ${ts}`,
  description: 'This task was created by the E2E test suite.',
  domain: 'personal',
  priority: 'high' as const,
};

export const testHabits = {
  name: `E2E Test Habit ${ts}`,
  description: 'A habit created by the E2E test suite.',
};

export const testProjects = {
  name: `E2E Test Project ${ts}`,
  description: 'A project created by the E2E test suite.',
};

export const testNotes = {
  title: `E2E Test Note ${ts}`,
  content: 'This note was created by the E2E test suite.',
  domain: 'personal',
};

export const testReports = {
  title: `E2E Test Report ${ts}`,
  content: 'This report was created by the E2E test suite.',
};

export const testDomains = {
  name: `e2e-domain-${ts}`,
};
