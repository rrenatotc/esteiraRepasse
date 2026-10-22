import { defineConfig } from '@playwright/test'

// E2E do app Electron buildado (out/). Veja e2e/ciclo.e2e.ts.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  reporter: 'list'
})
