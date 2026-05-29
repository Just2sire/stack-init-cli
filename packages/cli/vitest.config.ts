import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/*.test.ts'],
    snapshotOptions: {
      expand: false,
    },
  },
  resolve: {
    alias: {
      '@stack-init/schema': path.resolve(__dirname, '../schema/dist/index.js'),
    },
  },
})
