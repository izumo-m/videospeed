import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    setupFiles: ['./tests/helpers/vitest-setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
