import { defineConfig, devices } from '@playwright/test';

// CI runs chromium only (the runner installs just that browser + deps, keeping
// the pipeline fast). Locally the full 5-browser matrix runs by default.
const CI = !!process.env.CI;

const browserProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: CI
    ? browserProjects.filter((p) => p.name === 'chromium')
    : browserProjects,
  webServer: {
    // `bun run dev` boots the API (:3001) and the Vite dev server (:3000) via
    // concurrently. Poll the API health endpoint through the Vite proxy so we
    // don't start running tests until both servers are actually up.
    command: 'bun run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
