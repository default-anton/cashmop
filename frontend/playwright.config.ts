import { defineConfig, devices } from '@playwright/test';

const parsedBasePort = Number.parseInt(process.env.CASHMOP_TEST_BASE_PORT || '34115', 10);
const testBasePort = Number.isNaN(parsedBasePort) ? 34115 : parsedBasePort;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT, 10) : 2,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${testBasePort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
