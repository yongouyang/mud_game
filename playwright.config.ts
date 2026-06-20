import { execSync } from 'child_process';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

function resolvePort(): number {
  const cached = process.env.PLAYWRIGHT_PORT;
  if (cached) {
    const parsed = parseInt(cached, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const portScript = path.join(__dirname, 'scripts', 'find-port.cjs');
  const portOutput = execSync(`node "${portScript}"`, {
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
    .toString()
    .trim();
  const port = parseInt(portOutput, 10);
  if (Number.isNaN(port)) {
    throw new Error(`Failed to resolve an available port. Script output: "${portOutput}"`);
  }
  process.env.PLAYWRIGHT_PORT = String(port);
  return port;
}

const port = resolvePort();
const baseURL = `http://localhost:${port}`;

console.log(`[playwright] Using baseURL: ${baseURL}`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.E2E_PROD
      ? `cd server && PORT=${port} npm start`
      : `npm run dev:all -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.E2E_PROD ? 120000 : 60000,
  },
});
