import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;
export const ADMIN_PASSWORD = 'e2e-admin-password-1234';

/**
 * End-to-end tests against the real production build on a throwaway database.
 * Run `npm run build` first (CI does), then `npx playwright test`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'rm -rf e2e/.data && node server/dist/index.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATA_DIR: 'e2e/.data',
      WEB_DIR: 'web/dist',
      MIGRATIONS_DIR: 'server/drizzle',
      ADMIN_PASSWORD,
      PUBLIC_URL: `http://localhost:${PORT}`,
    },
  },
});
