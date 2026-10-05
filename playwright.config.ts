import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/showcase.spec.ts', '**/upload-metadata.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'showcase',
      testMatch: '**/showcase.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3001' },
    },
    {
      name: 'private-upload',
      testMatch: '**/upload-metadata.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3002' },
    },
  ],
  webServer: [
    {
      command: 'npm run start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'node node_modules/next/dist/bin/next start -p 3001 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        LUNIA_SHOWCASE: 'true',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        DATABASE_URL: '',
        PAYLOAD_SECRET: '',
        LUNIA_CMS_PREVIEW: '',
        BLOB_READ_WRITE_TOKEN: '',
        RESEND_API_KEY: '',
      },
    },
    {
      command: 'node node_modules/next/dist/bin/next start -p 3002 --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3002/admin/login',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        LUNIA_SHOWCASE: 'false',
        LUNIA_CMS_PREVIEW: 'false',
        LUNIA_STORAGE: 'private-blob',
        BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_syntheticstore_syntheticlocaltestonly',
      },
    },
  ],
})
