import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load E2E env from .env.e2e.local first (gitignored, holds real creds),
// falling back to .env.e2e.example for shape/documentation.
dotenv.config({ path: path.resolve(__dirname, '.env.e2e.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.e2e.example') });

const baseURL = process.env.E2E_BASE_URL || 'http://splintserver.local:3000';

export default defineConfig({
  testDir: './tests/e2e/specs',
  timeout: 5 * 60 * 1000, // generous: includes geo processing wait
  expect: { timeout: 10 * 1000 },
  fullyParallel: false, // single sanity test for now; serial keeps logs simple
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    // Ignore cert errors in case prod ever sits behind a staging cert
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
