import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Floors, not targets: just under what the suite reaches. Raise, never lower.
      thresholds: { statements: 95, branches: 86, functions: 95, lines: 97 },
    },
  },
});
