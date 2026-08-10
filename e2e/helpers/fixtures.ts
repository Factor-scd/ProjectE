/**
 * Shared test fixtures.
 *
 * The first login against a fresh database auto-creates the admin user from
 * INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD (see apps/api/src/routes/auth.ts),
 * so the E2E suite prefers those env vars and only falls back to hardcoded
 * defaults when running against a pre-seeded local database.
 */
export const TEST_USER = {
  email: process.env.E2E_EMAIL || process.env.INITIAL_ADMIN_EMAIL || 'test@example.com',
  password: process.env.E2E_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'testpassword123',
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
  description: 'This task was created by the E2E test suite.',
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
};

export const testCalendarEvents = {
  title: `E2E Test Event ${ts}`,
};

export const testCanvas = {
  name: `E2E Test Canvas ${ts}`,
};

export const testDomains = {
  name: `e2e-domain-${ts}`,
};

export const testWebhooks = {
  name: `E2E Test Webhook ${ts}`,
  url: `https://example.com/hooks/${ts}`,
};
