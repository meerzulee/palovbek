import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    viewport: { width:1440,height:1100 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(localChrome)?localChrome:undefined) },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
  outputDir:'artifacts/test-results',
});
