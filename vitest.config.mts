import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    environment: 'node',
    maxWorkers: 2 // PGlite usa bastante memória; mais workers estouram em PCs com pouca RAM
  }
})
