// Playwright contra la imagen Docker/servidor productivo ya arrancado por CI.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e-production',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: process.env.NETWIZARD_PRODUCTION_BASE_URL || 'http://127.0.0.1:8080',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  }
});
