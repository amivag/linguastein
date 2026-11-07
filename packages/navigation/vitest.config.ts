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
      thresholds: { statements: 89, branches: 76, functions: 88, lines: 90 },
    },
  },
});
