import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
             '--disable-frame-rate-limit', '--disable-gpu-vsync']
    }
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
