import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { channel: 'msedge', headless: true, viewport: { width: 1100, height: 850 } },
  webServer: { command: 'npm run dev -- --port 5191 --strictPort', url: 'http://127.0.0.1:5191', reuseExistingServer: false },
});
