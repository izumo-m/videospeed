import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.vitest.js'],
    setupFiles: ['./tests/helpers/vitest-setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
    passWithNoTests: true,
  },
});
