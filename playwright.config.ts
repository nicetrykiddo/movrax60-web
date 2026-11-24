import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
