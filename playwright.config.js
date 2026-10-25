process.env.NO_PROXY = 'localhost,127.0.0.1';
process.env.no_proxy = process.env.NO_PROXY;
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 30000,
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: 'http://127.0.0.1:4173/mind-arcade/',
    headless: true,
    launchOptions:
      process.platform === 'darwin'
        ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
        : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort --mode test',
    url: 'http://127.0.0.1:4173/mind-arcade/',
    reuseExistingServer: !process.env.CI,
  },
});
