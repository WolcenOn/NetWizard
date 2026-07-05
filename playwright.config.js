// Playwright E2E smoke tests for NetWizard.
// Run with: npm run test:e2e:install && npm run test:e2e
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npx http-server . -p 4173 -s -c-1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  }
});
